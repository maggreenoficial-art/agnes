-- Rode no SQL Editor depois do admin.sql
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
--
-- Sessões do funil: visitantes online, cidade e etapa do formulário.
-- Não guarda nome, e-mail, telefone nem o conteúdo dos campos.

create table if not exists public.funil_sessoes (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  cidade text,
  estado text,
  pais text,
  lat double precision,
  lng double precision,
  pagina text,
  etapa text not null default 'visitou',
  campos text[] not null default '{}',
  fotos int not null default 0
);

alter table public.funil_sessoes
  drop constraint if exists funil_sessoes_etapa_check;

alter table public.funil_sessoes
  add constraint funil_sessoes_etapa_check
  check (etapa in (
    'visitou',
    'formulario',
    'preenchendo',
    'fotos',
    'enviando',
    'inscrita'
  ));

create index if not exists funil_sessoes_last_seen_idx
  on public.funil_sessoes (last_seen desc);

create index if not exists funil_sessoes_created_at_idx
  on public.funil_sessoes (created_at desc);

alter table public.funil_sessoes enable row level security;

revoke all on table public.funil_sessoes from anon, authenticated;

create or replace function public.funil_etapa_rank(p_etapa text)
returns int
language sql
immutable
as $$
  select case p_etapa
    when 'visitou' then 1
    when 'formulario' then 2
    when 'preenchendo' then 3
    when 'fotos' then 4
    when 'enviando' then 5
    when 'inscrita' then 6
    else 0
  end;
$$;

create or replace function public.funil_ping(
  p_id uuid,
  p_pagina text,
  p_etapa text,
  p_campos text[],
  p_fotos int,
  p_cidade text,
  p_estado text,
  p_pais text,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa_ok text;
  campos_ok text[];
  fotos_ok int;
begin
  if p_id is null then
    return;
  end if;

  etapa_ok := case
    when p_etapa in ('visitou', 'formulario', 'preenchendo', 'fotos', 'enviando', 'inscrita')
      then p_etapa
    else 'visitou'
  end;

  select coalesce(array(
    select distinct left(trim(c), 40)
    from unnest(coalesce(p_campos, '{}')) as c
    where length(trim(c)) > 0
    limit 20
  ), '{}')
    into campos_ok;

  fotos_ok := greatest(0, least(coalesce(p_fotos, 0), 5));

  insert into public.funil_sessoes (
    id, last_seen, pagina, etapa, campos, fotos,
    cidade, estado, pais, lat, lng
  )
  values (
    p_id,
    now(),
    left(coalesce(p_pagina, '/'), 200),
    etapa_ok,
    campos_ok,
    fotos_ok,
    nullif(left(coalesce(p_cidade, ''), 80), ''),
    nullif(left(coalesce(p_estado, ''), 40), ''),
    nullif(left(coalesce(p_pais, ''), 8), ''),
    p_lat,
    p_lng
  )
  on conflict (id) do update set
    last_seen = now(),
    pagina = excluded.pagina,
    etapa = case
      when public.funil_etapa_rank(excluded.etapa) >= public.funil_etapa_rank(funil_sessoes.etapa)
        then excluded.etapa
      else funil_sessoes.etapa
    end,
    campos = excluded.campos,
    fotos = greatest(funil_sessoes.fotos, excluded.fotos),
    cidade = coalesce(excluded.cidade, funil_sessoes.cidade),
    estado = coalesce(excluded.estado, funil_sessoes.estado),
    pais = coalesce(excluded.pais, funil_sessoes.pais),
    lat = coalesce(excluded.lat, funil_sessoes.lat),
    lng = coalesce(excluded.lng, funil_sessoes.lng);
end;
$$;

create or replace function public.admin_funil_estado(p_secret text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inicio_hoje timestamptz;
  online_desde timestamptz;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  inicio_hoje := date_trunc('day', timezone('America/Sao_Paulo', now()))
    at time zone 'America/Sao_Paulo';
  online_desde := now() - interval '2 minutes';

  return json_build_object(
    'online', (
      select count(*)::int
      from public.funil_sessoes
      where last_seen >= online_desde
    ),
    'visitantes_hoje', (
      select count(*)::int
      from public.funil_sessoes
      where created_at >= inicio_hoje
    ),
    'inscritas_hoje', (
      select count(*)::int
      from public.inscricoes
      where created_at >= inicio_hoje
    ),
    'inscritas_total', (
      select count(*)::int from public.inscricoes
    ),
    'hoje', json_build_object(
      'visitou', (
        select count(*)::int from public.funil_sessoes
        where created_at >= inicio_hoje
      ),
      'formulario', (
        select count(*)::int from public.funil_sessoes
        where created_at >= inicio_hoje
          and public.funil_etapa_rank(etapa) >= 2
      ),
      'preenchendo', (
        select count(*)::int from public.funil_sessoes
        where created_at >= inicio_hoje
          and public.funil_etapa_rank(etapa) >= 3
      ),
      'fotos', (
        select count(*)::int from public.funil_sessoes
        where created_at >= inicio_hoje
          and public.funil_etapa_rank(etapa) >= 4
      ),
      'enviando', (
        select count(*)::int from public.funil_sessoes
        where created_at >= inicio_hoje
          and public.funil_etapa_rank(etapa) >= 5
      ),
      'inscrita', (
        select count(*)::int from public.inscricoes
        where created_at >= inicio_hoje
      )
    ),
    'sessoes', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json)
      from (
        select
          id,
          last_seen,
          cidade,
          estado,
          pais,
          lat,
          lng,
          pagina,
          etapa,
          campos,
          fotos
        from public.funil_sessoes
        where last_seen >= online_desde
        order by last_seen desc
        limit 200
      ) s
    )
  );
end;
$$;

revoke all on function public.funil_ping(uuid, text, text, text[], int, text, text, text, double precision, double precision) from public;
revoke all on function public.admin_funil_estado(text) from public;
revoke all on function public.funil_etapa_rank(text) from public;

grant execute on function public.funil_ping(uuid, text, text, text[], int, text, text, text, double precision, double precision) to anon, authenticated;
grant execute on function public.admin_funil_estado(text) to anon, authenticated;
