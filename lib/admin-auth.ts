import { cookies } from "next/headers";

const COOKIE_NAME = "agnes_admin";

function adminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Defina ADMIN_PASSWORD no .env.local");
  }
  return password;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function adminCookieValue() {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`agnes-admin:${adminPassword()}`),
  );
  return toHex(data);
}

export async function isAdmin() {
  try {
    const jar = await cookies();
    return jar.get(COOKIE_NAME)?.value === (await adminCookieValue());
  } catch {
    return false;
  }
}

export async function setAdminCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, await adminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export function getAdminSecret() {
  return adminPassword();
}
