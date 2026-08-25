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
  extras jsonb not null default '{}'::jsonb
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
