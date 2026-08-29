-- Uma vez: devolve à fila quem a Z-API não tem chat.
-- Manteve 51 números que realmente receberam (entregue/lido ou chat aberto).
-- Rode no SQL Editor:
-- https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new

update public.leads_meta l
  set
    email_fotos_em = null,
    email_resend_id = null,
    email_status = null,
    email_entregue_em = null,
    email_lido_em = null,
    email_clicou_em = null
where coalesce(l.email_resend_id, '') like 'wa:%'
  and right(
    case
      when left(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 2) = '55'
        and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 12
        then substring(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') from 3)
      else regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')
    end,
    8
  ) not in (
    '73424549',
    '90012406',
    '75531186',
    '90691687',
    '98934757',
    '79223581',
    '99918378',
    '73144108',
    '83025203',
    '95635588',
    '79430133',
    '96206719',
    '64307851',
    '69398485',
    '65278484',
    '78124646',
    '93620337',
    '95654432',
    '77381257',
    '79097581',
    '70617653',
    '81503845',
    '83779807',
    '75756162',
    '92906799',
    '82456851',
    '80727058',
    '97066820',
    '84206812',
    '73512959',
    '95145304',
    '93420239',
    '98318579',
    '88800644',
    '77015423',
    '92245381',
    '99922610',
    '66605550',
    '65576767',
    '72531287',
    '98136102',
    '77021958',
    '98530402',
    '71963249',
    '76352961',
    '64465824',
    '64669259',
    '88218171',
    '43586127',
    '81786601',
    '86123959'
  );

do $$
begin
  if to_regclass('public.whatsapp_fila') is not null then
    update public.whatsapp_fila
      set piloto_enviados = 0, modo = 'piloto'
    where id = 1;
  end if;
end $$;
