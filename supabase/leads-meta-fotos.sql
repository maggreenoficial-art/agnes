-- Rode no SQL Editor depois do leads-meta.sql
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
--
-- Fotos, Instagram, rastreio de e-mail e promoção do lead para inscrição
-- (link /acompanhar + aprovação no admin).

alter table public.leads_meta
  add column if not exists fotos text[] not null default '{}'::text[];

alter table public.inscricoes
  alter column data_nascimento drop not null;

alter table public.leads_meta
  add column if not exists inscricao_id uuid references public.inscricoes(id) on delete set null;

create index if not exists leads_meta_inscricao_id_idx
  on public.leads_meta (inscricao_id)
  where inscricao_id is not null;

create or replace function public.promover_lead_meta_inscricao(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.leads_meta;
  v_id uuid;
  v_tatuagens text;
  v_experiencia text;
  v_endereco text;
begin
  select * into l
  from public.leads_meta
  where id = p_lead_id;

  if l.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(l.fotos), 0) = 0 then
    return l.inscricao_id;
  end if;

  if l.inscricao_id is not null then
    update public.inscricoes
      set
        fotos = l.fotos,
        instagram = coalesce(nullif(trim(l.instagram), ''), instagram),
        telefone = coalesce(nullif(trim(l.telefone), ''), telefone),
        email = coalesce(nullif(trim(l.email), ''), email),
        nome_completo = coalesce(nullif(trim(l.nome_completo), ''), nome_completo)
    where id = l.inscricao_id;
    return l.inscricao_id;
  end if;

  select e.value into v_tatuagens
  from jsonb_each_text(coalesce(l.extras, '{}'::jsonb)) e
  where lower(e.key) ~ 'tatuag|piercing'
  limit 1;

  select e.value into v_experiencia
  from jsonb_each_text(coalesce(l.extras, '{}'::jsonb)) e
  where lower(e.key) ~ 'experiencia|modelo'
  limit 1;

  v_endereco := nullif(
    trim(concat_ws(' · ', nullif(trim(coalesce(l.endereco, '')), ''), nullif(trim(coalesce(l.cidade, '')), ''))),
    ''
  );
  v_id := gen_random_uuid();

  insert into public.inscricoes (
    id,
    nome_completo,
    data_nascimento,
    endereco,
    telefone,
    email,
    instagram,
    altura,
    cintura,
    quadril,
    busto,
    tatuagens_piercings,
    experiencia,
    fotos,
    status
  )
  values (
    v_id,
    left(trim(l.nome_completo), 160),
    l.data_nascimento,
    coalesce(v_endereco, 'Não informado'),
    coalesce(nullif(trim(l.telefone), ''), 'Não informado'),
    coalesce(nullif(lower(trim(l.email)), ''), ''),
    coalesce(nullif(trim(l.instagram), ''), '@pendente'),
    'Não informado',
    'Não informado',
    'Não informado',
    null,
    coalesce(nullif(trim(coalesce(v_tatuagens, '')), ''), 'Não informado'),
    nullif(trim(coalesce(v_experiencia, '')), ''),
    l.fotos,
    'nova'
  );

  update public.leads_meta
    set inscricao_id = v_id
  where id = l.id;

  return v_id;
end;
$$;

revoke all on function public.promover_lead_meta_inscricao(uuid) from public;

drop function if exists public.enviar_fotos_lead(text, text, text[]);
drop function if exists public.enviar_fotos_lead(text, text, text[], text);
drop function if exists public.enviar_fotos_lead(text, text, text[], text, uuid);

create or replace function public.enviar_fotos_lead(
  p_nome text,
  p_telefone text,
  p_fotos text[],
  p_instagram text default '',
  p_lead_id uuid default null,
  p_email text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_limpo text;
  fone_limpo text;
  email_limpo text;
  insta_limpo text;
  alvo uuid;
  perfil uuid;
begin
  nome_limpo := regexp_replace(lower(trim(p_nome)), '\s+', ' ', 'g');
  fone_limpo := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  email_limpo := lower(trim(coalesce(p_email, '')));
  insta_limpo := left(trim(coalesce(p_instagram, '')), 80);
  if left(fone_limpo, 2) = '55' and length(fone_limpo) >= 12 then
    fone_limpo := substring(fone_limpo from 3);
  end if;

  if length(nome_limpo) < 5 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if length(fone_limpo) < 10 then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if email_limpo = '' or email_limpo not like '%_@_%.__%' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if length(regexp_replace(insta_limpo, '^@', '')) < 2 then
    raise exception 'invalid instagram' using errcode = '22023';
  end if;
  if p_fotos is null or cardinality(p_fotos) <> 5 then
    raise exception 'invalid photos' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(p_fotos) as u(url)
    where url is null or url not like '%/inscricoes-fotos/%'
  ) then
    raise exception 'invalid photos' using errcode = '22023';
  end if;

  if p_lead_id is not null then
    select l.id into alvo
    from public.leads_meta l
    where l.id = p_lead_id;
  end if;

  if alvo is null then
    select l.id into alvo
    from public.leads_meta l
    where lower(trim(l.email)) = email_limpo
    order by coalesce(cardinality(l.fotos), 0) = 0 desc, l.created_at desc
    limit 1;
  end if;

  if alvo is null then
    select n.id into alvo
    from (
      select
        l.id,
        l.created_at,
        coalesce(cardinality(l.fotos), 0) as nfotos,
        case
          when left(d.digits, 2) = '55' and length(d.digits) >= 12
            then substring(d.digits from 3)
          else d.digits
        end as fone
      from public.leads_meta l
      cross join lateral (
        select regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') as digits
      ) d
    ) n
    where n.fone = fone_limpo
       or (
         length(n.fone) >= 8
         and length(fone_limpo) >= 8
         and right(n.fone, 8) = right(fone_limpo, 8)
       )
    order by n.nfotos = 0 desc, n.created_at desc
    limit 1;
  end if;

  if alvo is null then
    select l.id into alvo
    from public.leads_meta l
    where regexp_replace(lower(trim(l.nome_completo)), '\s+', ' ', 'g') = nome_limpo
    order by coalesce(cardinality(l.fotos), 0) = 0 desc, l.created_at desc
    limit 1;
  end if;

  if alvo is null then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  update public.leads_meta
    set
      fotos = p_fotos,
      instagram = insta_limpo,
      telefone = coalesce(nullif(left(trim(p_telefone), 40), ''), telefone),
      email = coalesce(nullif(email, ''), left(email_limpo, 160))
  where id = alvo;

  perfil := public.promover_lead_meta_inscricao(alvo);

  return json_build_object(
    'ok', true,
    'matched', true,
    'inscricao_id', perfil
  );
end;
$$;

revoke all on function public.enviar_fotos_lead(text, text, text[], text, uuid, text) from public;
grant execute on function public.enviar_fotos_lead(text, text, text[], text, uuid, text) to anon, authenticated;

alter table public.leads_meta
  add column if not exists email_fotos_em timestamptz,
  add column if not exists email_resend_id text,
  add column if not exists email_status text,
  add column if not exists email_entregue_em timestamptz,
  add column if not exists email_lido_em timestamptz,
  add column if not exists email_clicou_em timestamptz;

create index if not exists leads_meta_email_resend_id_idx
  on public.leads_meta (email_resend_id)
  where email_resend_id is not null;

drop function if exists public.admin_marcar_email_fotos(text, uuid[]);

create or replace function public.admin_marcar_email_fotos(
  p_secret text,
  p_items jsonb
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

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid payload';
  end if;

  update public.leads_meta l
    set
      email_fotos_em = now(),
      email_resend_id = nullif(item.email_id, ''),
      email_status = 'enviado',
      email_entregue_em = null,
      email_lido_em = null,
      email_clicou_em = null
  from (
    select
      (elem->>'id')::uuid as id,
      left(coalesce(elem->>'email_id', ''), 80) as email_id
    from jsonb_array_elements(p_items) as elem
    where coalesce(elem->>'id', '') <> ''
  ) item
  where l.id = item.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_evento_email_lead(
  p_secret text,
  p_email_id text,
  p_evento text,
  p_lead_id uuid default null,
  p_at timestamptz default now()
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  v_new text;
  v_rank int;
  v_at timestamptz;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_new := case p_evento
    when 'email.sent' then 'enviado'
    when 'email.delivered' then 'entregue'
    when 'email.opened' then 'lido'
    when 'email.clicked' then 'clicou'
    when 'email.bounced' then 'bounce'
    when 'email.failed' then 'falhou'
    when 'email.complained' then 'reclamou'
    when 'email.suppressed' then 'falhou'
    else null
  end;

  if v_new is null then
    return 0;
  end if;

  v_at := coalesce(p_at, now());
  v_rank := case v_new
    when 'enviado' then 1
    when 'entregue' then 2
    when 'lido' then 3
    when 'clicou' then 4
    when 'bounce' then 50
    when 'falhou' then 50
    when 'reclamou' then 50
    else 0
  end;

  update public.leads_meta l
    set
      email_resend_id = coalesce(l.email_resend_id, nullif(p_email_id, '')),
      email_fotos_em = coalesce(l.email_fotos_em, v_at),
      email_entregue_em = case
        when v_new = 'entregue' then coalesce(l.email_entregue_em, v_at)
        else l.email_entregue_em
      end,
      email_lido_em = case
        when v_new = 'lido' then coalesce(l.email_lido_em, v_at)
        else l.email_lido_em
      end,
      email_clicou_em = case
        when v_new = 'clicou' then coalesce(l.email_clicou_em, v_at)
        else l.email_clicou_em
      end,
      email_status = case
        when v_new in ('bounce', 'falhou', 'reclamou') then v_new
        when coalesce(l.email_status, '') in ('bounce', 'falhou', 'reclamou') then l.email_status
        when v_rank > case coalesce(l.email_status, '')
          when 'enviado' then 1
          when 'entregue' then 2
          when 'lido' then 3
          when 'clicou' then 4
          else 0
        end then v_new
        else coalesce(l.email_status, v_new)
      end
  where
    (
      nullif(p_email_id, '') is not null
      and l.email_resend_id = p_email_id
    )
    or (
      p_lead_id is not null
      and l.id = p_lead_id
      and (l.email_resend_id is null or l.email_resend_id = nullif(p_email_id, ''))
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_marcar_email_fotos(text, jsonb) from public;
revoke all on function public.admin_evento_email_lead(text, text, text, uuid, timestamptz) from public;
grant execute on function public.admin_marcar_email_fotos(text, jsonb) to anon, authenticated;
grant execute on function public.admin_evento_email_lead(text, text, text, uuid, timestamptz) to anon, authenticated;

-- Leads que já enviaram fotos viram perfil para a equipe avaliar.
do $$
declare
  r record;
begin
  for r in
    select id
    from public.leads_meta
    where coalesce(cardinality(fotos), 0) > 0
      and inscricao_id is null
  loop
    perform public.promover_lead_meta_inscricao(r.id);
  end loop;
end $$;
