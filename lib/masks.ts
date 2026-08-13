export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeInstagram(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const fromUrl = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i,
  );
  const handle = (fromUrl?.[1] ?? trimmed.replace(/^@/, "")).replace(/\/+$/, "");

  return handle ? `@${handle}` : "";
}

export function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
}

export function maskHeight(value: string) {
  const digits = onlyDigits(value).slice(0, 3);
  if (digits.length === 0) return "";
  if (digits.length === 1) return digits;
  return `${digits[0]},${digits.slice(1)}`;
}

export const MIN_AGE = 16;

export function maxBirthDateIso(minAge = MIN_AGE) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(date.getFullYear() - minAge);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isAtLeastAge(isoDate: string, minAge = MIN_AGE) {
  if (!isoDate) return false;
  const birth = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  return birth <= new Date(`${maxBirthDateIso(minAge)}T00:00:00`);
}
