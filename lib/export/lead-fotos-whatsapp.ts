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
    `Oi, ${oi} — aqui é da Mix Models.`,
    "",
    "Você se inscreveu no formulário da seleção com a Agnes Pimentel, o do anúncio no Instagram. Estou no cadastro que você mandou.",
    "",
    `Para concluir a inscrição, envia 5 fotos aqui: ${link}`,
    "",
    "Se não quiser mais receber, responde SAIR.",
  ].join("\n");
}

export const WHATSAPP_OPT_OUT_REPLY =
  "Beleza, não mando mais mensagem. Se mudar de ideia, o link das fotos continua no site.";
