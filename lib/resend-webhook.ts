import { createHmac, timingSafeEqual } from "crypto";

function header(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function signatures(value: string) {
  return value
    .split(/\s+/)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma === -1) return null;
      const version = part.slice(0, comma);
      const signature = part.slice(comma + 1);
      return version === "v1" && signature ? signature : null;
    })
    .filter((item): item is string => Boolean(item));
}

function sameSignature(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyResendWebhook(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const id = header(headers, "svix-id") ?? header(headers, "webhook-id");
  const timestamp =
    header(headers, "svix-timestamp") ?? header(headers, "webhook-timestamp");
  const signatureHeader =
    header(headers, "svix-signature") ?? header(headers, "webhook-signature");

  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret,
    "base64",
  );
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");

  return signatures(signatureHeader).some((item) => sameSignature(expected, item));
}

function tagValue(
  tags: unknown,
  name: string,
): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    for (const item of tags) {
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        "value" in item &&
        String(item.name) === name
      ) {
        return String(item.value);
      }
    }
    return null;
  }
  if (typeof tags === "object" && name in tags) {
    const value = (tags as Record<string, unknown>)[name];
    return value == null ? null : String(value);
  }
  return null;
}

export function parseResendEmailEvent(payload: string): {
  type: string;
  emailId: string;
  leadId: string | null;
  at: string | null;
} | null {
  let parsed: {
    type?: unknown;
    created_at?: unknown;
    data?: {
      created_at?: unknown;
      email_id?: unknown;
      tags?: unknown;
    };
  };

  try {
    parsed = JSON.parse(payload) as typeof parsed;
  } catch {
    return null;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";
  if (!type.startsWith("email.")) return null;

  const emailId =
    typeof parsed.data?.email_id === "string" ? parsed.data.email_id : "";
  const at =
    (typeof parsed.data?.created_at === "string" && parsed.data.created_at) ||
    (typeof parsed.created_at === "string" && parsed.created_at) ||
    null;
  const leadRaw = tagValue(parsed.data?.tags, "lead_id");
  const leadId =
    leadRaw &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      leadRaw,
    )
      ? leadRaw
      : null;

  return { type, emailId, leadId, at };
}
