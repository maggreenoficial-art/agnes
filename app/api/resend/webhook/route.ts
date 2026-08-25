import { getAdminSecret } from "@/lib/admin-auth";
import { verifyResendWebhook, parseResendEmailEvent } from "@/lib/resend-webhook";
import { applyLeadEmailEvent } from "@/lib/leads-meta";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyResendWebhook(payload, request.headers)) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const event = parseResendEmailEvent(payload);
  if (!event) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    getAdminSecret();
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }

  const result = await applyLeadEmailEvent({
    emailId: event.emailId,
    evento: event.type,
    leadId: event.leadId,
    at: event.at,
  });

  if (result.error && result.error !== "sql-missing") {
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
