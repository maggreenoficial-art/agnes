-- Rode no SQL Editor do Supabase
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
-- Permite excluir um cadastro pela área admin

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

revoke all on function public.admin_excluir_inscricao(text, uuid) from public;
grant execute on function public.admin_excluir_inscricao(text, uuid) to anon, authenticated;

drop policy if exists "Exclusao de fotos da inscricao" on storage.objects;
create policy "Exclusao de fotos da inscricao"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'inscricoes-fotos');
