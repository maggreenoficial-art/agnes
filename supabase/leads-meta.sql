-- Rode no SQL Editor depois do admin.sql
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
--
-- Leads do formulário instantâneo da Meta (CSV).
-- Ficam separados das inscrições do site.

create table if not exists public.leads_meta (
  id uuid primary key default gen_random_uuid(),
  meta_lead_id text not null unique,
  created_at timestamptz not null default now(),
  imported_at timestamptz not null default now(),
  nome_completo text not null,
  email text not null default '',
  telefone text not null default '',
  cidade text,
  endereco text,
  instagram text,
  data_nascimento date,
  campanha text,
  conjunto text,
  anuncio text,
  formulario text,
  plataforma text,
  extras jsonb not null default '{}'::jsonb,
  fotos text[] not null default '{}'::text[]
);

create index if not exists leads_meta_created_at_idx
  on public.leads_meta (created_at desc);

create index if not exists leads_meta_email_idx
  on public.leads_meta (email);

alter table public.leads_meta enable row level security;

revoke all on table public.leads_meta from anon, authenticated;

create or replace function public.admin_listar_leads_meta(p_secret text)
returns setof public.leads_meta
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
    select *
    from public.leads_meta
    order by created_at desc;
end;
$$;

create or replace function public.admin_importar_leads_meta(
  p_secret text,
  p_leads jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  lead jsonb;
  inserted_count int := 0;
  updated_count int := 0;
  was_insert boolean;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if jsonb_typeof(p_leads) is distinct from 'array' then
    raise exception 'invalid payload';
  end if;

  for lead in select value from jsonb_array_elements(p_leads)
  loop
    if coalesce(lead->>'nome_completo', '') = '' then
      continue;
    end if;
    if coalesce(lead->>'meta_lead_id', '') = '' then
      continue;
    end if;

    insert into public.leads_meta (
      meta_lead_id,
      created_at,
      nome_completo,
      email,
      telefone,
      cidade,
      endereco,
      instagram,
      data_nascimento,
      campanha,
      conjunto,
      anuncio,
      formulario,
      plataforma,
      extras
    )
    values (
      left(lead->>'meta_lead_id', 120),
      coalesce((lead->>'created_at')::timestamptz, now()),
      left(lead->>'nome_completo', 160),
      left(coalesce(lead->>'email', ''), 160),
      left(coalesce(lead->>'telefone', ''), 40),
      nullif(left(coalesce(lead->>'cidade', ''), 80), ''),
      nullif(left(coalesce(lead->>'endereco', ''), 200), ''),
      nullif(left(coalesce(lead->>'instagram', ''), 80), ''),
      nullif(lead->>'data_nascimento', '')::date,
      nullif(left(coalesce(lead->>'campanha', ''), 160), ''),
      nullif(left(coalesce(lead->>'conjunto', ''), 160), ''),
      nullif(left(coalesce(lead->>'anuncio', ''), 160), ''),
      nullif(left(coalesce(lead->>'formulario', ''), 160), ''),
      nullif(left(coalesce(lead->>'plataforma', ''), 40), ''),
      coalesce(lead->'extras', '{}'::jsonb)
    )
    on conflict (meta_lead_id) do update set
      created_at = excluded.created_at,
      nome_completo = excluded.nome_completo,
      email = excluded.email,
      telefone = excluded.telefone,
      cidade = excluded.cidade,
      endereco = excluded.endereco,
      instagram = excluded.instagram,
      data_nascimento = excluded.data_nascimento,
      campanha = excluded.campanha,
      conjunto = excluded.conjunto,
      anuncio = excluded.anuncio,
      formulario = excluded.formulario,
      plataforma = excluded.plataforma,
      extras = excluded.extras,
      imported_at = now()
    returning (xmax = 0) into was_insert;

    if was_insert then
      inserted_count := inserted_count + 1;
    else
      updated_count := updated_count + 1;
    end if;
  end loop;

  return json_build_object(
    'inseridos', inserted_count,
    'atualizados', updated_count
  );
end;
$$;

create or replace function public.admin_excluir_lead_meta(p_secret text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  removido uuid;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  delete from public.leads_meta
    where id = p_id
    returning id into removido;

  if removido is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return removido;
end;
$$;

revoke all on function public.admin_listar_leads_meta(text) from public;
revoke all on function public.admin_importar_leads_meta(text, jsonb) from public;
revoke all on function public.admin_excluir_lead_meta(text, uuid) from public;

grant execute on function public.admin_listar_leads_meta(text) to anon, authenticated;
grant execute on function public.admin_importar_leads_meta(text, jsonb) to anon, authenticated;
grant execute on function public.admin_excluir_lead_meta(text, uuid) to anon, authenticated;

alter table public.leads_meta
  add column if not exists fotos text[] not null default '{}'::text[];

drop function if exists public.enviar_fotos_lead(text, text, text[]);

create or replace function public.enviar_fotos_lead(
  p_nome text,
  p_telefone text,
  p_fotos text[],
  p_instagram text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_limpo text;
  fone_limpo text;
  insta_limpo text;
  alvo uuid;
begin
  nome_limpo := regexp_replace(lower(trim(p_nome)), '\s+', ' ', 'g');
  fone_limpo := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
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

  select n.id into alvo
  from (
    select
      l.id,
      l.created_at,
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
  order by n.created_at desc
  limit 1;

  if alvo is null then
    select l.id into alvo
    from public.leads_meta l
    where regexp_replace(lower(trim(l.nome_completo)), '\s+', ' ', 'g') = nome_limpo
    order by coalesce(cardinality(l.fotos), 0) = 0 desc, l.created_at desc
    limit 1;
  end if;

  if alvo is not null then
    update public.leads_meta
      set
        fotos = p_fotos,
        instagram = insta_limpo
    where id = alvo;
    return json_build_object('ok', true, 'matched', true);
  end if;

  insert into public.leads_meta (
    meta_lead_id,
    nome_completo,
    telefone,
    instagram,
    fotos,
    plataforma
  )
  values (
    left('fotos:' || gen_random_uuid()::text, 120),
    left(trim(p_nome), 160),
    left(trim(p_telefone), 40),
    insta_limpo,
    p_fotos,
    'site'
  );

  return json_build_object('ok', true, 'matched', false);
end;
$$;

revoke all on function public.enviar_fotos_lead(text, text, text[], text) from public;
grant execute on function public.enviar_fotos_lead(text, text, text[], text) to anon, authenticated;
