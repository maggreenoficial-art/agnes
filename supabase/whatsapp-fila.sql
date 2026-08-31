-- Fila humana do WhatsApp: um envio por vez, piloto de 10, descadastro.
-- Rode no SQL Editor:
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new

alter table public.leads_meta
  add column if not exists whatsapp_opt_out_em timestamptz;

create table if not exists public.whatsapp_fila (
  id int primary key default 1 check (id = 1),
  modo text not null default 'piloto'
    check (modo in ('piloto', 'liberado', 'pausado')),
  modo_antes_pausa text,
  piloto_limite int not null default 10,
  piloto_enviados int not null default 0,
  ultimo_envio_em timestamptz,
  proximo_intervalo_seg int not null default 300
);

alter table public.whatsapp_fila enable row level security;
revoke all on table public.whatsapp_fila from anon, authenticated;

insert into public.whatsapp_fila (id)
values (1)
on conflict (id) do nothing;

alter table public.whatsapp_fila
  add column if not exists modo_antes_pausa text;

create or replace function public.admin_whatsapp_fila(p_secret text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into fila from public.whatsapp_fila where id = 1;
  return json_build_object(
    'modo', fila.modo,
    'modo_antes_pausa', fila.modo_antes_pausa,
    'piloto_limite', fila.piloto_limite,
    'piloto_enviados', fila.piloto_enviados,
    'ultimo_envio_em', fila.ultimo_envio_em,
    'proximo_intervalo_seg', fila.proximo_intervalo_seg
  );
end;
$$;

create or replace function public.admin_whatsapp_registrar_envio(
  p_secret text,
  p_intervalo_seg int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.whatsapp_fila
    set
      ultimo_envio_em = now(),
      proximo_intervalo_seg = greatest(120, least(coalesce(p_intervalo_seg, 300), 900)),
      piloto_enviados = case
        when modo = 'piloto' then piloto_enviados + 1
        else piloto_enviados
      end
  where id = 1
  returning * into fila;

  return json_build_object(
    'modo', fila.modo,
    'piloto_limite', fila.piloto_limite,
    'piloto_enviados', fila.piloto_enviados,
    'ultimo_envio_em', fila.ultimo_envio_em,
    'proximo_intervalo_seg', fila.proximo_intervalo_seg
  );
end;
$$;

create or replace function public.admin_whatsapp_set_modo(
  p_secret text,
  p_modo text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_modo not in ('piloto', 'liberado', 'pausado') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  update public.whatsapp_fila
    set
      modo_antes_pausa = case
        when p_modo = 'pausado' and modo <> 'pausado' then modo
        when p_modo = 'pausado' then modo_antes_pausa
        else null
      end,
      modo = p_modo
  where id = 1
  returning * into fila;

  return json_build_object(
    'modo', fila.modo,
    'piloto_limite', fila.piloto_limite,
    'piloto_enviados', fila.piloto_enviados,
    'ultimo_envio_em', fila.ultimo_envio_em,
    'proximo_intervalo_seg', fila.proximo_intervalo_seg
  );
end;
$$;

create or replace function public.admin_whatsapp_opt_out(
  p_secret text,
  p_phone text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  fone text;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  fone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if left(fone, 2) = '55' and length(fone) >= 12 then
    fone := substring(fone from 3);
  end if;
  if length(fone) < 8 then
    return 0;
  end if;

  update public.leads_meta l
    set whatsapp_opt_out_em = coalesce(l.whatsapp_opt_out_em, now())
  where right(
      case
        when left(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 2) = '55'
          and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 12
          then substring(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') from 3)
        else regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')
      end,
      8
    ) = right(fone, 8);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_whatsapp_fila(text) from public;
revoke all on function public.admin_whatsapp_registrar_envio(text, int) from public;
revoke all on function public.admin_whatsapp_set_modo(text, text) from public;
revoke all on function public.admin_whatsapp_opt_out(text, text) from public;
grant execute on function public.admin_whatsapp_fila(text) to anon, authenticated;
grant execute on function public.admin_whatsapp_registrar_envio(text, int) to anon, authenticated;
grant execute on function public.admin_whatsapp_set_modo(text, text) to anon, authenticated;
grant execute on function public.admin_whatsapp_opt_out(text, text) to anon, authenticated;

-- Respostas das leads (webhook Ao receber) + histórico de envio.
alter table public.leads_meta
  add column if not exists whatsapp_ultima_resposta text,
  add column if not exists whatsapp_ultima_resposta_em timestamptz;

create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads_meta(id) on delete set null,
  phone text not null,
  direcao text not null check (direcao in ('out', 'in')),
  texto text not null default '',
  tipo text not null default 'text',
  message_id text,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_mensagens enable row level security;
revoke all on table public.whatsapp_mensagens from anon, authenticated;

create index if not exists whatsapp_mensagens_lead_created_idx
  on public.whatsapp_mensagens (lead_id, created_at desc);
create index if not exists whatsapp_mensagens_created_idx
  on public.whatsapp_mensagens (created_at desc);
create unique index if not exists whatsapp_mensagens_message_id_uidx
  on public.whatsapp_mensagens (message_id)
  where message_id is not null and length(message_id) > 0;

create or replace function public.admin_whatsapp_registrar_mensagem(
  p_secret text,
  p_phone text,
  p_direcao text,
  p_texto text,
  p_tipo text default 'text',
  p_message_id text default null,
  p_lead_id uuid default null,
  p_at timestamptz default now()
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fone text;
  lead uuid;
  msg public.whatsapp_mensagens;
  quando timestamptz;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_direcao not in ('out', 'in') then
    raise exception 'invalid direction' using errcode = '22023';
  end if;

  quando := coalesce(p_at, now());
  fone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if left(fone, 2) = '55' and length(fone) >= 12 then
    fone := substring(fone from 3);
  end if;

  if p_message_id is not null and length(p_message_id) > 0 then
    select * into msg
    from public.whatsapp_mensagens
    where message_id = p_message_id
    limit 1;
    if found then
      return json_build_object(
        'id', msg.id,
        'lead_id', msg.lead_id,
        'duplicated', true
      );
    end if;
  end if;

  lead := p_lead_id;
  if lead is null and length(fone) >= 8 then
    select l.id into lead
    from public.leads_meta l
    where right(
        case
          when left(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 2) = '55'
            and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 12
            then substring(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') from 3)
          else regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')
        end,
        8
      ) = right(fone, 8)
    order by l.email_fotos_em desc nulls last, l.created_at desc
    limit 1;
  end if;

  insert into public.whatsapp_mensagens (
    lead_id, phone, direcao, texto, tipo, message_id, created_at
  )
  values (
    lead,
    coalesce(nullif(fone, ''), p_phone, ''),
    p_direcao,
    coalesce(p_texto, ''),
    coalesce(nullif(p_tipo, ''), 'text'),
    nullif(p_message_id, ''),
    quando
  )
  returning * into msg;

  if p_direcao = 'in' and lead is not null and length(trim(coalesce(p_texto, ''))) > 0 then
    update public.leads_meta
      set
        whatsapp_ultima_resposta = trim(p_texto),
        whatsapp_ultima_resposta_em = quando
    where id = lead;
  end if;

  return json_build_object(
    'id', msg.id,
    'lead_id', msg.lead_id,
    'duplicated', false
  );
end;
$$;

revoke all on function public.admin_whatsapp_registrar_mensagem(text, text, text, text, text, text, uuid, timestamptz) from public;
grant execute on function public.admin_whatsapp_registrar_mensagem(text, text, text, text, text, text, uuid, timestamptz) to anon, authenticated;

create or replace function public.admin_whatsapp_desmarcar(
  p_secret text,
  p_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  update public.leads_meta
    set
      email_fotos_em = null,
      email_resend_id = null,
      email_status = null,
      email_entregue_em = null,
      email_lido_em = null,
      email_clicou_em = null
  where id = any(p_ids)
    and coalesce(email_resend_id, '') like 'wa:%';

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_whatsapp_desmarcar(text, uuid[]) from public;
grant execute on function public.admin_whatsapp_desmarcar(text, uuid[]) to anon, authenticated;

-- Envio automático: continua mesmo com o painel fechado.
alter table public.whatsapp_fila
  add column if not exists auto_envio boolean not null default false;
alter table public.whatsapp_fila
  add column if not exists tick_lock_em timestamptz;

create or replace function public.admin_whatsapp_fila(p_secret text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into fila from public.whatsapp_fila where id = 1;
  return json_build_object(
    'modo', fila.modo,
    'modo_antes_pausa', fila.modo_antes_pausa,
    'piloto_limite', fila.piloto_limite,
    'piloto_enviados', fila.piloto_enviados,
    'ultimo_envio_em', fila.ultimo_envio_em,
    'proximo_intervalo_seg', fila.proximo_intervalo_seg,
    'auto_envio', fila.auto_envio
  );
end;
$$;

create or replace function public.admin_whatsapp_set_modo(
  p_secret text,
  p_modo text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_modo not in ('piloto', 'liberado', 'pausado') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  update public.whatsapp_fila
    set
      modo_antes_pausa = case
        when p_modo = 'pausado' and modo <> 'pausado' then modo
        when p_modo = 'pausado' then modo_antes_pausa
        else null
      end,
      auto_envio = case
        when p_modo = 'pausado' then false
        else auto_envio
      end,
      modo = p_modo
  where id = 1
  returning * into fila;

  return json_build_object(
    'modo', fila.modo,
    'auto_envio', fila.auto_envio,
    'piloto_limite', fila.piloto_limite,
    'piloto_enviados', fila.piloto_enviados,
    'ultimo_envio_em', fila.ultimo_envio_em,
    'proximo_intervalo_seg', fila.proximo_intervalo_seg
  );
end;
$$;

create or replace function public.admin_whatsapp_set_auto(
  p_secret text,
  p_auto boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.whatsapp_fila
    set auto_envio = coalesce(p_auto, false)
  where id = 1
    and modo <> 'pausado'
  returning * into fila;

  if not found then
    select * into fila from public.whatsapp_fila where id = 1;
  end if;

  return json_build_object(
    'modo', fila.modo,
    'auto_envio', fila.auto_envio
  );
end;
$$;

create or replace function public.admin_whatsapp_claim_tick(p_secret text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.whatsapp_fila;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.whatsapp_fila
    set tick_lock_em = now()
  where id = 1
    and auto_envio = true
    and modo in ('piloto', 'liberado')
    and not (modo = 'piloto' and piloto_enviados >= piloto_limite)
    and (tick_lock_em is null or tick_lock_em < now() - interval '50 seconds')
    and (
      ultimo_envio_em is null
      or ultimo_envio_em + make_interval(secs => greatest(proximo_intervalo_seg, 120)) <= now()
    )
  returning * into fila;

  if not found then
    return json_build_object('claimed', false);
  end if;

  return json_build_object('claimed', true);
end;
$$;

revoke all on function public.admin_whatsapp_set_auto(text, boolean) from public;
revoke all on function public.admin_whatsapp_claim_tick(text) from public;
grant execute on function public.admin_whatsapp_set_auto(text, boolean) to anon, authenticated;
grant execute on function public.admin_whatsapp_claim_tick(text) to anon, authenticated;
