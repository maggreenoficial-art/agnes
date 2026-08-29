import {
  leadEmailBounce,
  leadEmailEntregue,
  leadEmailLido,
  leadMetaConfirmado,
  leadTemWhatsapp,
  leadWhatsappEnviado,
  leadWhatsappSaiu,
} from "@/lib/lead-meta-status";
import type { LeadMeta } from "@/lib/leads-meta";
import { whatsappDigits } from "@/lib/z-api";

export type WhatsappModo = "piloto" | "liberado" | "pausado";

export type WhatsappFilaEstado = {
  modo: WhatsappModo;
  modoAntesPausa: WhatsappModo | null;
  pilotoLimite: number;
  pilotoEnviados: number;
  ultimoEnvioEm: string | null;
  proximoIntervaloSeg: number;
  esperaSeg: number;
  sqlMissing: boolean;
};

const TIMEZONE = "America/Sao_Paulo";

export function filaWhatsapp(leads: LeadMeta[]) {
  return leads.filter(
    (item) =>
      !leadMetaConfirmado(item) &&
      leadTemWhatsapp(item) &&
      !leadWhatsappEnviado(item) &&
      !leadWhatsappSaiu(item),
  );
}

export function isOptOutText(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return (
    /^(sair|parar|stop|cancelar|descadastrar|nao)$/.test(normalized) ||
    /\b(sair|stop|parar|nao quero|nao mandar|descadastr)\b/.test(normalized)
  );
}

export function incomingText(body: {
  text?: unknown;
  message?: unknown;
}): string {
  if (typeof body.text === "string") return body.text;
  if (body.text && typeof body.text === "object" && "message" in body.text) {
    return String((body.text as { message?: unknown }).message ?? "");
  }
  if (typeof body.message === "string") return body.message;
  return "";
}

function nowInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { weekday, minutes: hour * 60 + minute };
}

export function whatsappHorarioError() {
  const { weekday, minutes } = nowInSaoPaulo();
  if (weekday === "Sun") {
    return "Domingo a gente não manda. Retoma segunda, das 9h30 às 22h.";
  }
  if (weekday === "Sat") {
    if (minutes < 10 * 60 || minutes >= 16 * 60) {
      return "Sábado só das 10h às 16h (horário de Brasília).";
    }
    return null;
  }
  if (minutes < 9 * 60 + 30 || minutes >= 22 * 60) {
    return "Fora do horário de conversa (9h30–22h em Brasília).";
  }
  return null;
}

export function randomIntervaloSeg() {
  return 240 + Math.floor(Math.random() * 301);
}

export function findLeadByPhone(leads: LeadMeta[], phone: string) {
  const alvo = whatsappDigits(phone);
  if (!alvo) return null;
  return (
    leads.find((item) => whatsappDigits(item.telefone) === alvo) ??
    leads.find((item) => {
      const digits = whatsappDigits(item.telefone);
      return digits.slice(-8) === alvo.slice(-8);
    }) ??
    null
  );
}

export function whatsappMonitor(leads: LeadMeta[]) {
  const piloto = leads.filter(
    (item) =>
      leadWhatsappEnviado(item) &&
      item.email_fotos_em &&
      new Date(item.email_fotos_em).getTime() > Date.now() - 36 * 60 * 60 * 1000,
  );
  const enviados = piloto.length;
  const entregues = piloto.filter(leadEmailEntregue).length;
  const lidos = piloto.filter(leadEmailLido).length;
  const falhou = piloto.filter(leadEmailBounce).length;
  const saiu = leads.filter(leadWhatsappSaiu).length;
  return { enviados, entregues, lidos, falhou, saiu };
}

export function podeLiberarFila(
  estado: WhatsappFilaEstado,
  monitor: ReturnType<typeof whatsappMonitor>,
) {
  if (estado.modo === "liberado") return false;
  if (estado.pilotoEnviados < estado.pilotoLimite) return false;
  if (monitor.falhou >= 3) return false;
  if (monitor.saiu >= 3) return false;
  return true;
}

export function webhookPhone(body: {
  phone?: unknown;
  chatId?: unknown;
}): string {
  const raw = String(body.phone ?? body.chatId ?? "");
  return raw.replace(/@c\.us$/i, "").replace(/\D/g, "");
}

function mediaCaption(value: unknown) {
  if (!value || typeof value !== "object") return "";
  if ("caption" in value) return String((value as { caption?: unknown }).caption ?? "").trim();
  if ("message" in value) return String((value as { message?: unknown }).message ?? "").trim();
  return "";
}

export function incomingPreview(body: {
  text?: unknown;
  message?: unknown;
  image?: unknown;
  audio?: unknown;
  video?: unknown;
  document?: unknown;
  sticker?: unknown;
  location?: unknown;
  contact?: unknown;
  reaction?: unknown;
  ptt?: unknown;
}): { texto: string; tipo: string } {
  const text = incomingText(body).trim();
  if (text) return { texto: text, tipo: "text" };
  const image = mediaCaption(body.image);
  if (body.image) return { texto: image || "[foto]", tipo: "image" };
  if (body.audio || body.ptt) return { texto: "[áudio]", tipo: "audio" };
  const video = mediaCaption(body.video);
  if (body.video) return { texto: video || "[vídeo]", tipo: "video" };
  const doc = mediaCaption(body.document);
  if (body.document) return { texto: doc || "[arquivo]", tipo: "document" };
  if (body.sticker) return { texto: "[figurinha]", tipo: "sticker" };
  if (body.location) return { texto: "[localização]", tipo: "location" };
  if (body.contact) return { texto: "[contato]", tipo: "contact" };
  if (body.reaction) return { texto: "[reação]", tipo: "reaction" };
  return { texto: "", tipo: "empty" };
}

export function bloqueioEnvio(estado: WhatsappFilaEstado) {
  if (estado.modo === "pausado") {
    return "A fila está pausada.";
  }
  if (estado.modo === "piloto" && estado.pilotoEnviados >= estado.pilotoLimite) {
    return `Piloto concluído (${estado.pilotoEnviados}/${estado.pilotoLimite}). Olhe entregue/lido/SAIR no painel antes de liberar o restante.`;
  }
  if (estado.esperaSeg > 0) {
    const min = Math.ceil(estado.esperaSeg / 60);
    return `Espere ${min} min. Um envio por vez, com pausa de conversa real.`;
  }
  return whatsappHorarioError();
}
