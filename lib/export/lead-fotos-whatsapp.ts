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
    `Oi, ${oi}! O seu perfil chegou até a equipe da Mix Models com a Agnes Pimentel e o Instituto Imperatriz.`,
    "",
    "Estamos montando o grupo da seleção presencial e queremos te avaliar com o cuidado que o seu perfil merece. O próximo passo é o book: cinco fotos só suas.",
    "",
    `Envie aqui: ${link}`,
    "",
    "Mix Models Agency · Instituto Imperatriz Leopoldinense",
  ].join("\n");
}
