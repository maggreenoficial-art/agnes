-- Rode este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- Projeto: acbksachtpypwtbgwyxh

create table if not exists public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome_completo text not null,
  data_nascimento date,
  endereco text not null,
  telefone text not null,
  email text not null,
  instagram text not null,
  altura text not null,
  cintura text not null,
  quadril text not null,
  busto text,
  tatuagens_piercings text not null,
  experiencia text,
  fotos text[] not null
);

create index if not exists inscricoes_created_at_idx
  on public.inscricoes (created_at desc);

create index if not exists inscricoes_email_idx
  on public.inscricoes (email);

alter table public.inscricoes enable row level security;

alter table public.inscricoes
  alter column data_nascimento drop not null;

drop policy if exists "Permitir insercao publica de inscricoes" on public.inscricoes;
create policy "Permitir insercao publica de inscricoes"
  on public.inscricoes
  for insert
  to anon, authenticated
  with check (true);

grant insert on table public.inscricoes to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inscricoes-fotos',
  'inscricoes-fotos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Upload publico de fotos da inscricao" on storage.objects;
create policy "Upload publico de fotos da inscricao"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'inscricoes-fotos');

drop policy if exists "Leitura publica de fotos da inscricao" on storage.objects;
create policy "Leitura publica de fotos da inscricao"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'inscricoes-fotos');

drop policy if exists "Exclusao de fotos da inscricao" on storage.objects;
create policy "Exclusao de fotos da inscricao"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'inscricoes-fotos');

alter table public.inscricoes
  add column if not exists status text not null default 'nova';

alter table public.inscricoes
  drop constraint if exists inscricoes_status_check;

alter table public.inscricoes
  add constraint inscricoes_status_check
  check (status in ('nova', 'em_analise', 'aprovada', 'reprovada'));

create table if not exists public.admin_settings (
  id int primary key default 1 check (id = 1),
  secret text not null
);

alter table public.admin_settings enable row level security;

revoke all on table public.admin_settings from anon, authenticated;

insert into public.admin_settings (id, secret)
values (1, 'imperatriz-agnes-2026')
on conflict (id) do update set secret = excluded.secret;

create or replace function public.admin_listar_inscricoes(p_secret text)
returns setof public.inscricoes
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
    from public.inscricoes
    order by created_at desc;
end;
$$;

create or replace function public.admin_obter_inscricao(p_secret text, p_id uuid)
returns public.inscricoes
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado public.inscricoes;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into resultado
  from public.inscricoes
  where id = p_id;

  if resultado is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return resultado;
end;
$$;

create or replace function public.admin_atualizar_status(
  p_secret text,
  p_id uuid,
  p_status text
)
returns public.inscricoes
language plpgsql
security definer
set search_path = public
as $$
declare
  atualizado public.inscricoes;
begin
  if not exists (
    select 1 from public.admin_settings
    where id = 1 and secret = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_status not in ('nova', 'em_analise', 'aprovada', 'reprovada') then
    raise exception 'invalid status';
  end if;

  update public.inscricoes
    set status = p_status
    where id = p_id
    returning * into atualizado;

  if atualizado is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return atualizado;
end;
$$;

create or replace function public.admin_excluir_inscricao(p_secret text, p_id uuid)
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

  delete from public.inscricoes
    where id = p_id
    returning id into removido;

  if removido is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return removido;
end;
$$;

revoke all on function public.admin_listar_inscricoes(text) from public;
revoke all on function public.admin_obter_inscricao(text, uuid) from public;
revoke all on function public.admin_atualizar_status(text, uuid, text) from public;
revoke all on function public.admin_excluir_inscricao(text, uuid) from public;

grant execute on function public.admin_listar_inscricoes(text) to anon, authenticated;
grant execute on function public.admin_obter_inscricao(text, uuid) to anon, authenticated;
grant execute on function public.admin_atualizar_status(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_excluir_inscricao(text, uuid) to anon, authenticated;

create or replace function public.acompanhar_inscricao(p_id uuid)
returns table (
  id uuid,
  nome_completo text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nome_completo, i.status, i.created_at
  from public.inscricoes i
  where i.id = p_id;
$$;

revoke all on function public.acompanhar_inscricao(uuid) from public;
grant execute on function public.acompanhar_inscricao(uuid) to anon, authenticated;
