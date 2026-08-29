import { getAdminSecret } from "@/lib/admin-auth";
import { WHATSAPP_OPT_OUT_REPLY } from "@/lib/export/lead-fotos-whatsapp";
import { applyLeadEmailEvent, listLeadsMeta } from "@/lib/leads-meta";
import {
  incomingPreview,
  isOptOutText,
  webhookPhone,
} from "@/lib/whatsapp-fila";
import {
  marcarWhatsappOptOut,
  registrarMensagemWhatsapp,
} from "@/lib/whatsapp-fila-server";
import { sendZapiText } from "@/lib/z-api";

export const runtime = "nodejs";

type ZapiPayload = {
  instanceId?: string;
  status?: string;
  type?: string;
  fromMe?: boolean;
  phone?: string;
  chatId?: string;
  ids?: unknown;
  id?: string;
  messageId?: string;
  momment?: number;
  moment?: number;
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
};

function eventFromStatus(status: string) {
  const value = status.trim().toUpperCase();
  if (value === "SENT") return "email.sent";
  if (value === "RECEIVED") return "email.delivered";
  if (value === "READ" || value === "PLAYED") return "email.opened";
  return null;
}

function messageIds(body: ZapiPayload) {
  const ids = new Set<string>();
  if (Array.isArray(body.ids)) {
    for (const item of body.ids) {
      if (item) ids.add(String(item));
    }
  }
  if (body.messageId) ids.add(String(body.messageId));
  if (body.id) ids.add(String(body.id));
  return [...ids];
}

function eventAt(body: ZapiPayload) {
  const stamp = body.momment ?? body.moment;
  if (typeof stamp === "number" && Number.isFinite(stamp) && stamp > 0) {
    return new Date(stamp > 1e12 ? stamp : stamp * 1000).toISOString();
  }
  return new Date().toISOString();
}

function parseBody(payload: string): ZapiPayload | null {
  try {
    const json = JSON.parse(payload) as ZapiPayload;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return Response.json({ ok: true });
}

async function handleIncoming(body: ZapiPayload) {
  if (body.status && eventFromStatus(body.status)) return null;
  if (body.fromMe) return { ok: true, ignored: true };
  const type = (body.type ?? "").toLowerCase();
  if (type && type !== "receivedcallback" && type !== "received") {
    return null;
  }
  const phone = webhookPhone(body);
  if (!phone) return null;
  const preview = incomingPreview(body);
  if (!preview.texto) return null;

  const at = eventAt(body);
  const messageId = String(body.messageId ?? body.id ?? "");
  await registrarMensagemWhatsapp({
    phone,
    direcao: "in",
    texto: preview.texto,
    tipo: preview.tipo,
    messageId,
    at,
  });

  if (!isOptOutText(preview.texto)) {
    return { ok: true, received: true };
  }

  const opted = await marcarWhatsappOptOut(phone);
  if (opted.n === 0) {
    const listed = await listLeadsMeta();
    const lead = listed.data.find((item) => {
      const digits = (item.telefone ?? "").replace(/\D/g, "");
      return digits.slice(-8) === phone.slice(-8);
    });
    if (lead) {
      await applyLeadEmailEvent({
        emailId: lead.email_resend_id || "wa:optout",
        evento: "email.complained",
        leadId: lead.id,
      });
    }
  }

  try {
    await sendZapiText({
      phone,
      message: WHATSAPP_OPT_OUT_REPLY,
      delayTyping: 3,
      delayMessage: 2,
    });
  } catch (caught) {
    console.error(caught);
  }

  return { ok: true, optOut: true };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const body = parseBody(payload);
  if (!body) return Response.json({ ok: true, ignored: true });

  const expectedInstance = process.env.ZAPI_INSTANCE_ID?.trim();
  if (
    expectedInstance &&
    body.instanceId &&
    body.instanceId !== expectedInstance
  ) {
    return new Response("Invalid instance", { status: 401 });
  }

  try {
    getAdminSecret();
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }

  const incoming = await handleIncoming(body);
  if (incoming) return Response.json(incoming);

  const evento = eventFromStatus(body.status ?? "");
  const ids = messageIds(body);
  if (!evento || ids.length === 0) {
    return Response.json({ ok: true, ignored: true });
  }

  const at = eventAt(body);
  for (const id of ids) {
    const result = await applyLeadEmailEvent({
      emailId: id.startsWith("wa:") ? id : `wa:${id}`,
      evento,
      at,
    });
    if (result.error && result.error !== "sql-missing") {
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
