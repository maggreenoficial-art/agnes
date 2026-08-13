export type InscricaoStatus =
  | "nova"
  | "em_analise"
  | "aprovada"
  | "reprovada";

export type Inscricao = {
  id: string;
  created_at: string;
  nome_completo: string;
  data_nascimento: string;
  endereco: string;
  telefone: string;
  email: string;
  instagram: string;
  altura: string;
  cintura: string;
  quadril: string;
  busto: string | null;
  tatuagens_piercings: string;
  experiencia: string | null;
  fotos: string[];
  status: InscricaoStatus;
};

export const STATUS_LABEL: Record<InscricaoStatus, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

export const STATUS_PUBLIC_LABEL: Record<InscricaoStatus, string> = {
  nova: "Recebida",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  reprovada: "Não segue nesta etapa",
};

export const STATUS_PUBLIC_TEXT: Record<InscricaoStatus, string> = {
  nova: "Recebemos o seu perfil. A equipe ainda vai avaliar as informações e as fotos.",
  em_analise: "Seu perfil está em análise pela equipe da Mix Models e do Instituto Imperatriz.",
  aprovada:
    "Você foi aprovada para a etapa presencial no dia 12 de setembro, na quadra da Imperatriz Leopoldinense. Confira o endereço e o mapa abaixo.",
  reprovada:
    "Neste momento o seu perfil não segue para a etapa presencial. Obrigada por participar.",
};

export const STATUS_OPTIONS: InscricaoStatus[] = [
  "nova",
  "em_analise",
  "aprovada",
  "reprovada",
];

const TIMEZONE_BR = "America/Sao_Paulo";

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

export function idade(isoDate: string) {
  const nascimento = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const hoje = todayInSaoPaulo();
  let years = hoje.year - nascimento.getFullYear();
  const monthDelta = hoje.month - (nascimento.getMonth() + 1);
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && hoje.day < nascimento.getDate())
  ) {
    years -= 1;
  }
  return years;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE_BR,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(new Date(`${value}T00:00:00`));
}

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

export function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export function normalizeStatus(value: string | null | undefined): InscricaoStatus {
  if (
    value === "nova" ||
    value === "em_analise" ||
    value === "aprovada" ||
    value === "reprovada"
  ) {
    return value;
  }
  return "nova";
}
