-- Rode no SQL Editor do Supabase
-- Permite que a candidata acompanhe o status pelo link único

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
