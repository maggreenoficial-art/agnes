import { createHash } from "crypto";
import { maskPhone, onlyDigits, parseBrDateToIso } from "@/lib/masks";

export type MetaLeadParsed = {
  meta_lead_id: string;
  created_at: string | null;
  nome_completo: string;
  email: string;
  telefone: string;
  cidade: string;
  endereco: string;
  instagram: string;
  data_nascimento: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  formulario: string;
  plataforma: string;
  extras: Record<string, string>;
};

const KNOWN = new Set([
  "id",
  "lead_id",
  "meta_lead_id",
  "created_time",
  "created_at",
  "data_de_criacao",
  "full_name",
  "nome_completo",
  "nome",
  "first_name",
  "last_name",
  "primeiro_nome",
  "sobrenome",
  "email",
  "e_mail",
  "phone_number",
  "phone",
  "telefone",
  "numero_de_telefone",
  "whatsapp",
  "city",
  "cidade",
  "street_address",
  "endereco",
  "address",
  "instagram",
  "usuario_do_instagram",
  "date_of_birth",
  "data_de_nascimento",
  "nascimento",
  "campaign_name",
  "nome_da_campanha",
  "adset_name",
  "nome_do_conjunto",
  "ad_name",
  "nome_do_anuncio",
  "form_name",
  "nome_do_formulario",
  "platform",
  "plataforma",
  "ad_id",
  "adset_id",
  "campaign_id",
  "form_id",
  "is_organic",
  "nome_proprio",
  "apelido",
  "morada",
  "lead_status",
]);

function decodeCsvBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (bytes.length >= 4 && bytes[1] === 0 && bytes[3] === 0) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function detectDelimiter(line: string) {
  const counts = { "\t": 0, ";": 0, ",": 0 };
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char in counts) {
      counts[char as keyof typeof counts] += 1;
    }
  }
  if (counts["\t"] >= counts[";"] && counts["\t"] >= counts[","]) {
    return counts["\t"] > 0 ? "\t" : ",";
  }
  return counts[";"] > counts[","] ? ";" : ",";
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = source.split("\n").find((line) => line.trim()) ?? "";
  const delimiter = detectDelimiter(firstLine);

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

function pickExact(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return "";
}

function pick(row: Record<string, string>, keys: string[]) {
  const exact = pickExact(row, keys);
  if (exact) return exact;
  for (const [key, value] of Object.entries(row)) {
    if (!value.trim()) continue;
    if (keys.some((needle) => key.includes(needle))) return value.trim();
  }
  return "";
}

function parseCreatedAt(value: string) {
  if (!value) return null;
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  const br = parseBrDateToIso(value);
  return br ? `${br}T12:00:00.000Z` : null;
}

function parseBirth(value: string) {
  if (!value) return "";
  const br = parseBrDateToIso(value);
  if (br) return br;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1] ?? "";
}

function normalizePhone(value: string) {
  let digits = onlyDigits(value.replace(/^p:/i, ""));
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return maskPhone(digits);
}

function fingerprint(parts: string[]) {
  return createHash("sha256")
    .update(parts.join("|").toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function parseMetaLeadsCsv(input: string | ArrayBuffer): {
  leads: MetaLeadParsed[];
  skipped: number;
  error?: string;
} {
  const text = typeof input === "string" ? input : decodeCsvBytes(input);
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { leads: [], skipped: 0, error: "O CSV está vazio ou sem linhas de lead." };
  }

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const header = normalizeHeader(cell);
      return (
        header === "id" ||
        header === "created_time" ||
        header.includes("email") ||
        header.includes("e_mail") ||
        header.includes("full_name") ||
        header.includes("nome_proprio") ||
        header.includes("nome_completo")
      );
    }),
  );

  if (headerIndex < 0 || headerIndex >= rows.length - 1) {
    return {
      leads: [],
      skipped: 0,
      error: "Não achei o cabeçalho do CSV da Meta. Exporte de novo em Formulários instantâneos → Baixar.",
    };
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const leads: MetaLeadParsed[] = [];
  let skipped = 0;

  for (const cells of rows.slice(headerIndex + 1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = cells[index] ?? "";
    });

    const first = pickExact(row, [
      "first_name",
      "primeiro_nome",
      "nome_proprio",
    ]);
    const last = pickExact(row, ["last_name", "sobrenome", "apelido"]);
    const nome =
      pickExact(row, ["full_name", "nome_completo"]) ||
      [first, last].filter(Boolean).join(" ").trim() ||
      first;

    if (!nome) {
      skipped += 1;
      continue;
    }

    const email = pick(row, ["email", "e_mail"]).toLowerCase();
    const telefone = normalizePhone(
      pick(row, ["phone_number", "phone", "telefone", "whatsapp", "numero_de_telefone"]),
    );
    const metaId =
      pick(row, ["id", "lead_id", "meta_lead_id"]) ||
      `csv:${fingerprint([nome, email, telefone, pick(row, ["created_time", "created_at"])])}`;

    const extras: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!value || KNOWN.has(key)) continue;
      extras[key] = value;
    }

    const instagram =
      pick(row, ["instagram", "usuario_do_instagram"]) ||
      Object.entries(row).find(
        ([key, value]) => key.includes("instagram") && value.trim(),
      )?.[1]?.trim() ||
      "";

    leads.push({
      meta_lead_id: metaId.slice(0, 120),
      created_at: parseCreatedAt(
        pick(row, ["created_time", "created_at", "data_de_criacao"]),
      ),
      nome_completo: nome.slice(0, 160),
      email: email.slice(0, 160),
      telefone,
      cidade: pick(row, ["city", "cidade"]),
      endereco: pick(row, ["street_address", "endereco", "address", "morada"]),
      instagram: instagram.slice(0, 80),
      data_nascimento: parseBirth(
        pick(row, ["date_of_birth", "data_de_nascimento", "nascimento"]),
      ),
      campanha: pick(row, ["campaign_name", "nome_da_campanha"]),
      conjunto: pick(row, ["adset_name", "nome_do_conjunto"]),
      anuncio: pick(row, ["ad_name", "nome_do_anuncio"]),
      formulario: pick(row, ["form_name", "nome_do_formulario"]),
      plataforma: pick(row, ["platform", "plataforma"]),
      extras,
    });
  }

  return { leads: leads.slice(0, 3000), skipped };
}
