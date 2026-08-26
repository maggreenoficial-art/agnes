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
    `Envie 5 fotos aqui: ${link}`,
    "",
    "Mesmo WhatsApp do anúncio, Instagram aberto, fundo liso, camiseta preta ou branca e calça jeans ou preta.",
  ].join("\n");
}
