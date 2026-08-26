const FOTOS_URL = "https://www.agnespimentel.com/fotos";

function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0] || "";
}

export function leadFotosLink(leadId?: string, origem = "whatsapp") {
  if (!leadId) return `${FOTOS_URL}?origem=${origem}`;
  return `${FOTOS_URL}?origem=${origem}&lead=${encodeURIComponent(leadId)}`;
}

export function leadFotosWhatsappMessage(nomeCompleto: string, leadId?: string) {
  const primeiro = primeiroNome(nomeCompleto);
  const link = leadFotosLink(leadId);
  const oi = primeiro || "Oi";
  return [
    `Oi, ${oi}! A *Mix Models* escolheu o seu perfil para a seleção com a Agnes Pimentel.`,
    "",
    `Para concluir a inscrição, envie as 5 fotos: ${link}`,
  ].join("\n");
}
