export const FUNIL_ETAPAS = [
  "visitou",
  "formulario",
  "preenchendo",
  "fotos",
  "enviando",
  "inscrita",
] as const;

export type FunilEtapa = (typeof FUNIL_ETAPAS)[number];

export type FunilSessao = {
  id: string;
  last_seen: string;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  lat: number | null;
  lng: number | null;
  pagina: string | null;
  etapa: FunilEtapa;
  campos: string[];
  fotos: number;
};

export type FunilEstado = {
  online: number;
  visitantes_hoje: number;
  inscritas_hoje: number;
  inscritas_total: number;
  hoje: Record<FunilEtapa, number>;
  sessoes: FunilSessao[];
};

export const FUNIL_LABEL: Record<FunilEtapa, string> = {
  visitou: "No site",
  formulario: "Viu o formulário",
  preenchendo: "Preenchendo",
  fotos: "Enviando fotos",
  enviando: "Finalizando",
  inscrita: "Inscrita",
};

export const CAMPO_LABEL: Record<string, string> = {
  nomeCompleto: "Nome",
  dataNascimento: "Nascimento",
  endereco: "Endereço",
  telefone: "Telefone",
  email: "E-mail",
  instagram: "Instagram",
  altura: "Altura",
  cintura: "Cintura",
  quadril: "Quadril",
  busto: "Busto",
  tatuagens: "Tatuagens",
  experiencia: "Experiência",
  fotos: "Fotos",
};

export function isFunilEtapa(value: string): value is FunilEtapa {
  return (FUNIL_ETAPAS as readonly string[]).includes(value);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSessionId(value: string) {
  return UUID.test(value);
}

export function decodeGeoText(value: string | null) {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.trim();
  }
}
