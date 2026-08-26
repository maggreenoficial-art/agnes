export type LeadEmailStatus =
  | "enviado"
  | "entregue"
  | "lido"
  | "clicou"
  | "bounce"
  | "falhou"
  | "reclamou";

export function leadMetaConfirmado(lead: { fotos?: string[] | null }) {
  return (lead.fotos ?? []).some((url) => Boolean(url?.trim()));
}

export function leadTemEmail(lead: { email?: string | null }) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((lead.email ?? "").trim());
}

export function leadTemWhatsapp(lead: { telefone?: string | null }) {
  const digits = (lead.telefone ?? "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return true;
  return digits.length === 10 || digits.length === 11;
}

export function leadWhatsappEnviado(lead: { email_resend_id?: string | null }) {
  return (lead.email_resend_id ?? "").startsWith("wa:");
}

export function leadEmailStatus(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}): LeadEmailStatus | null {
  const status = lead.email_status?.trim();
  if (
    status === "enviado" ||
    status === "entregue" ||
    status === "lido" ||
    status === "clicou" ||
    status === "bounce" ||
    status === "falhou" ||
    status === "reclamou"
  ) {
    return status;
  }
  if (lead.email_fotos_em) return "enviado";
  return null;
}

export function leadEmailEnviado(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}) {
  return leadEmailStatus(lead) !== null;
}

export function leadEmailLido(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}) {
  const status = leadEmailStatus(lead);
  return status === "lido" || status === "clicou";
}

export function leadEmailClicou(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}) {
  return leadEmailStatus(lead) === "clicou";
}

export function leadEmailEntregue(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}) {
  const status = leadEmailStatus(lead);
  return status === "entregue" || status === "lido" || status === "clicou";
}

export function leadEmailBounce(lead: {
  email_status?: string | null;
  email_fotos_em?: string | null;
}) {
  const status = leadEmailStatus(lead);
  return status === "bounce" || status === "falhou" || status === "reclamou";
}
