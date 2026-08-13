import {
  STATUS_LABEL,
  formatDate,
  formatDateTime,
  idade,
  instagramUrl,
  type Inscricao,
} from "@/lib/inscricao";

export function fileBaseName(perfil: Inscricao) {
  const slug = perfil.nome_completo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `ficha-${slug || perfil.id.slice(0, 8)}`;
}

export function profileRows(perfil: Inscricao): Array<[string, string]> {
  const years = idade(perfil.data_nascimento);

  return [
    ["Nome completo", perfil.nome_completo],
    ["Status", STATUS_LABEL[perfil.status]],
    ["Idade", years !== null ? `${years} anos` : "—"],
    ["Nascimento", formatDate(perfil.data_nascimento)],
    ["Telefone", perfil.telefone],
    ["E-mail", perfil.email],
    ["Instagram", perfil.instagram],
    ["Instagram (link)", instagramUrl(perfil.instagram)],
    ["Endereço", perfil.endereco],
    ["Altura", perfil.altura],
    ["Cintura", perfil.cintura],
    ["Quadril", perfil.quadril],
    ["Busto", perfil.busto || "—"],
    ["Tatuagens ou piercings", perfil.tatuagens_piercings],
    ["Experiência", perfil.experiencia || "Não informada"],
    ["Inscrita em", formatDateTime(perfil.created_at)],
  ];
}

export function attachmentFileName(base: string, extension: string) {
  const ascii = `${base}.${extension}`;
  const encoded = encodeURIComponent(ascii);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
