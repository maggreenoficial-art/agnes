-- Rode no SQL Editor depois do leads-meta.sql
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new
--
-- Fotos enviadas pela página /fotos (quem veio do formulário instantâneo).

alter table public.leads_meta
  add column if not exists fotos text[] not null default '{}'::text[];

create or replace function public.enviar_fotos_lead(
  p_nome text,
  p_telefone text,
  p_fotos text[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_limpo text;
  fone_limpo text;
  alvo uuid;
begin
  nome_limpo := regexp_replace(lower(trim(p_nome)), '\s+', ' ', 'g');
  fone_limpo := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if left(fone_limpo, 2) = '55' and length(fone_limpo) >= 12 then
    fone_limpo := substring(fone_limpo from 3);
  end if;

  if length(nome_limpo) < 5 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if length(fone_limpo) < 10 then
    raise exception 'invalid phone' using errcode = '22023';
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
      set fotos = p_fotos
    where id = alvo;
    return json_build_object('ok', true, 'matched', true);
  end if;

  insert into public.leads_meta (
    meta_lead_id,
    nome_completo,
    telefone,
    fotos,
    plataforma
  )
  values (
    left('fotos:' || gen_random_uuid()::text, 120),
    left(trim(p_nome), 160),
    left(trim(p_telefone), 40),
    p_fotos,
    'site'
  );

  return json_build_object('ok', true, 'matched', false);
end;
$$;

revoke all on function public.enviar_fotos_lead(text, text, text[]) from public;
grant execute on function public.enviar_fotos_lead(text, text, text[]) to anon, authenticated;
