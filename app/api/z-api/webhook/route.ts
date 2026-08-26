import { getAdminSecret } from "@/lib/admin-auth";
import { applyLeadEmailEvent } from "@/lib/leads-meta";

export const runtime = "nodejs";

type ZapiPayload = {
  instanceId?: string;
  status?: string;
  type?: string;
  ids?: unknown;
  id?: string;
  messageId?: string;
  momment?: number;
  moment?: number;
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

  const evento = eventFromStatus(body.status ?? "");
  const ids = messageIds(body);
  if (!evento || ids.length === 0) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    getAdminSecret();
  } catch {
    return Response.json({ ok: false }, { status: 500 });
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
