import { createHash } from "crypto";
import { headers } from "next/headers";

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1523707485735767";

const ALLOWED_EVENTS = new Set(["PageView", "Lead", "CompleteRegistration"]);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function hashIfPresent(value?: string | null) {
  const normalized = value ? normalizeText(value) : "";
  return normalized ? sha256(normalized) : undefined;
}

function hashPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return sha256(withCountry);
}

export type MetaEventInput = {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  fbp?: string | null;
  fbc?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  testEventCode?: string | null;
};

function hasEnoughUserData(userData: Record<string, unknown>) {
  const hasMatchKeys =
    Boolean(userData.em) ||
    Boolean(userData.ph) ||
    Boolean(userData.fbp) ||
    Boolean(userData.fbc);
  const hasClient =
    Boolean(userData.client_ip_address) && Boolean(userData.client_user_agent);
  return hasMatchKeys || hasClient;
}

export async function sendMetaCapiEvent(input: MetaEventInput) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || !ALLOWED_EVENTS.has(input.eventName) || !input.eventId) {
    return { ok: false as const };
  }

  const userData: Record<string, unknown> = {};
  const email = hashIfPresent(input.email);
  const phone = hashPhone(input.phone);
  const firstName = hashIfPresent(input.firstName);
  const lastName = hashIfPresent(input.lastName);
  if (email) userData.em = [email];
  if (phone) userData.ph = [phone];
  if (firstName) userData.fn = [firstName];
  if (lastName) userData.ln = [lastName];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  if (!hasEnoughUserData(userData)) {
    return { ok: false as const };
  }

  const testEventCode =
    input.testEventCode?.trim() || process.env.META_TEST_EVENT_CODE?.trim();

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
      },
    ],
    access_token: token,
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("Meta CAPI error", response.status, detail);
    return { ok: false as const };
  }

  return { ok: true as const };
}

function firstIp(value: string) {
  const raw = value.split(",")[0]?.trim() ?? "";
  if (!raw) return undefined;
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(raw)) return raw.split(":")[0];
  return raw;
}

export async function clientContextFromRequest() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const clientIp =
    firstIp(forwarded) ||
    headerList.get("x-real-ip") ||
    headerList.get("cf-connecting-ip") ||
    undefined;
  const userAgent = headerList.get("user-agent") || undefined;
  return { clientIp, userAgent };
}
