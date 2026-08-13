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
    "Você foi aprovada para a etapa presencial na quadra da Imperatriz Leopoldinense. Fique atenta ao Instagram e ao WhatsApp.",
  reprovada:
    "Neste momento o seu perfil não segue para a etapa presencial. Obrigada por participar.",
};

export const STATUS_OPTIONS: InscricaoStatus[] = [
  "nova",
  "em_analise",
  "aprovada",
  "reprovada",
];

export function idade(isoDate: string) {
  const nascimento = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const hoje = new Date();
  let years = hoje.getFullYear() - nascimento.getFullYear();
  const monthDelta = hoje.getMonth() - nascimento.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && hoje.getDate() < nascimento.getDate())
  ) {
    years -= 1;
  }
  return years;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
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
