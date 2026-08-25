export function leadMetaConfirmado(lead: { fotos?: string[] | null }) {
  return (lead.fotos ?? []).some((url) => Boolean(url?.trim()));
}
