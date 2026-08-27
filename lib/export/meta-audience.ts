import { idade, type Inscricao } from "@/lib/inscricao";
import { leadMetaConfirmado } from "@/lib/lead-meta-status";
import type { LeadMeta } from "@/lib/leads-meta";
import { whatsappDigits } from "@/lib/z-api";

export type AudienceRow = {
  email: string;
  phone: string;
  fn: string;
  ln: string;
  zip: string;
  ct: string;
  st: string;
  country: string;
  dob: string;
  doby: string;
  gen: string;
  age: string;
  uid: string;
  value: number;
};

const HEADER = [
  "email",
  "email",
  "email",
  "phone",
  "phone",
  "phone",
  "madid",
  "fn",
  "ln",
  "zip",
  "ct",
  "st",
  "country",
  "dob",
  "doby",
  "gen",
  "age",
  "uid",
  "value",
];

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function splitName(nomeCompleto: string) {
  const parts = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { fn: "", ln: "" };
  if (parts.length === 1) return { fn: parts[0], ln: "" };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

function zipFromText(...parts: Array<string | null | undefined>) {
  const blob = parts.filter(Boolean).join(" ");
  const match = blob.match(/(\d{5})-?(\d{3})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function stateFromText(...parts: Array<string | null | undefined>) {
  const blob = parts.filter(Boolean).join(" ").toUpperCase();
  const match = blob.match(
    /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/,
  );
  return match?.[1] ?? "";
}

function cityFromText(cidade?: string | null, endereco?: string | null) {
  if (cidade?.trim()) return cidade.trim();
  const text = endereco?.trim() ?? "";
  if (!text) return "";
  const chunks = text.split(/[,—\-]/).map((part) => part.trim()).filter(Boolean);
  const withoutCep = chunks.filter((part) => !/^\d{5}-?\d{3}$/.test(part));
  const withoutUf = withoutCep.filter(
    (part) => !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(part),
  );
  return withoutUf.at(-1) ?? "";
}

function birthFields(iso?: string | null) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { dob: "", doby: "", age: "" };
  }
  const [year, month, day] = iso.split("-");
  const years = idade(iso);
  return {
    dob: `${month}/${day}/${year.slice(2)}`,
    doby: year,
    age: years !== null ? String(years) : "",
  };
}

function siteValue(perfil: Inscricao) {
  if (perfil.status === "aprovada") return 100;
  if (perfil.status === "em_analise") return 70;
  if (perfil.status === "reprovada") return 10;
  if ((perfil.fotos ?? []).some((url) => url?.trim())) return 55;
  return 40;
}

function metaValue(lead: LeadMeta) {
  if (leadMetaConfirmado(lead)) return 50;
  if (lead.email_fotos_em) return 20;
  return 12;
}

function fingerprint(email: string, phone: string) {
  return `${email}|${phone}`;
}

export function buildEngajadosAudience(
  inscricoes: Inscricao[],
  leads: LeadMeta[],
): AudienceRow[] {
  const rows: AudienceRow[] = [];
  const seen = new Set<string>();

  function push(row: AudienceRow) {
    if (!row.email && !row.phone) return;
    const key = fingerprint(row.email, row.phone);
    if (key !== "|" && seen.has(key)) return;
    if (row.email && seen.has(`e:${row.email}`)) return;
    if (row.phone && seen.has(`p:${row.phone}`)) return;
    if (row.email) seen.add(`e:${row.email}`);
    if (row.phone) seen.add(`p:${row.phone}`);
    seen.add(key);
    rows.push(row);
  }

  const siteIds = new Set(inscricoes.map((item) => item.id));

  for (const perfil of inscricoes) {
    const { fn, ln } = splitName(perfil.nome_completo);
    const birth = birthFields(perfil.data_nascimento);
    push({
      email: perfil.email.trim().toLowerCase(),
      phone: whatsappDigits(perfil.telefone),
      fn,
      ln,
      zip: zipFromText(perfil.endereco),
      ct: cityFromText(null, perfil.endereco),
      st: stateFromText(perfil.endereco),
      country: "BR",
      ...birth,
      gen: "",
      uid: perfil.id,
      value: siteValue(perfil),
    });
  }

  for (const lead of leads) {
    if (lead.inscricao_id && siteIds.has(lead.inscricao_id)) continue;
    const { fn, ln } = splitName(lead.nome_completo);
    const birth = birthFields(lead.data_nascimento);
    push({
      email: (lead.email ?? "").trim().toLowerCase(),
      phone: whatsappDigits(lead.telefone ?? ""),
      fn,
      ln,
      zip: zipFromText(lead.endereco, lead.cidade),
      ct: cityFromText(lead.cidade, lead.endereco),
      st: stateFromText(lead.cidade, lead.endereco),
      country: "BR",
      ...birth,
      gen: "",
      uid: lead.id,
      value: metaValue(lead),
    });
  }

  return rows.sort((a, b) => b.value - a.value);
}

export function audienceToCsv(rows: AudienceRow[]) {
  const lines = [
    HEADER.join(","),
    ...rows.map((row) =>
      [
        row.email,
        "",
        "",
        row.phone,
        "",
        "",
        "",
        row.fn,
        row.ln,
        row.zip,
        row.ct,
        row.st,
        row.country,
        row.dob,
        row.doby,
        row.gen,
        row.age,
        row.uid,
        row.value,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
