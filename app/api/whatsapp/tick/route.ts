import { processarFilaWhatsapp } from "@/lib/whatsapp-enviar";

export const runtime = "nodejs";
export const maxDuration = 60;

function tickAuthorized(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const expected = [process.env.CRON_SECRET, process.env.ADMIN_PASSWORD]
    .map((value) => value?.trim())
    .filter(Boolean);
  return expected.includes(token);
}

async function handleTick(request: Request) {
  if (!tickAuthorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const result = await processarFilaWhatsapp();
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handleTick(request);
}

export async function POST(request: Request) {
  return handleTick(request);
}
