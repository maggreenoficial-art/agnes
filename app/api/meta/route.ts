import { clientContextFromRequest, sendMetaCapiEvent } from "@/lib/meta";

export const runtime = "nodejs";

const ALLOWED = new Set(["PageView", "Lead", "CompleteRegistration"]);

export async function POST(request: Request) {
  let body: {
    eventName?: string;
    eventId?: string;
    eventSourceUrl?: string;
    fbp?: string;
    fbc?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const eventName = body.eventName?.trim() ?? "";
  const eventId = body.eventId?.trim() ?? "";
  if (!ALLOWED.has(eventName) || !eventId) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { clientIp, userAgent } = await clientContextFromRequest();

  await sendMetaCapiEvent({
    eventName,
    eventId,
    eventSourceUrl: body.eventSourceUrl,
    fbp: body.fbp,
    fbc: body.fbc,
    email: eventName === "PageView" ? undefined : body.email,
    phone: eventName === "PageView" ? undefined : body.phone,
    firstName: eventName === "PageView" ? undefined : body.firstName,
    lastName: eventName === "PageView" ? undefined : body.lastName,
    clientIp,
    userAgent,
  });

  return Response.json({ ok: true });
}
