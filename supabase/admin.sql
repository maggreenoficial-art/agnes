-- Rode no SQL Editor depois do schema.sql
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
--
-- A senha abaixo PRECISA ser a mesma do ADMIN_PASSWORD no .env.local

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

revoke all on function public.admin_listar_inscricoes(text) from public;
revoke all on function public.admin_obter_inscricao(text, uuid) from public;
revoke all on function public.admin_atualizar_status(text, uuid, text) from public;

grant execute on function public.admin_listar_inscricoes(text) to anon, authenticated;
grant execute on function public.admin_obter_inscricao(text, uuid) to anon, authenticated;
grant execute on function public.admin_atualizar_status(text, uuid, text) to anon, authenticated;

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
