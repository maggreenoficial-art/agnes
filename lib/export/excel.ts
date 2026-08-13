import ExcelJS from "exceljs";
import { profileRows } from "@/lib/export/fields";
import {
  STATUS_LABEL,
  formatDate,
  formatDateTime,
  idade,
  instagramUrl,
  type Inscricao,
} from "@/lib/inscricao";

const LIME = "FFC8EB4B";
const DEEP = "FF04170F";
const CREAM = "FFF6F3EA";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: DEEP }, name: "Calibri", size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: LIME },
  };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

export async function buildProfileExcel(perfil: Inscricao) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mix Models";
  workbook.created = new Date();

  const ficha = workbook.addWorksheet("Ficha", {
    properties: { tabColor: { argb: LIME } },
  });
  ficha.columns = [
    { header: "Campo", key: "campo", width: 28 },
    { header: "Informação", key: "valor", width: 72 },
  ];
  styleHeader(ficha.getRow(1));

  for (const [campo, valor] of profileRows(perfil)) {
    const row = ficha.addRow({ campo, valor });
    row.alignment = { vertical: "top", wrapText: true };
  }

  ficha.getColumn(1).font = { bold: true, color: { argb: "FF0C7A3E" } };
  ficha.eachRow((row, index) => {
    if (index === 1) return;
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: CREAM },
      };
    }
  });

  const fotos = workbook.addWorksheet("Fotos");
  fotos.columns = [
    { header: "#", key: "n", width: 8 },
    { header: "URL da foto", key: "url", width: 90 },
  ];
  styleHeader(fotos.getRow(1));
  perfil.fotos.forEach((url, index) => {
    const row = fotos.addRow({ n: index + 1, url });
    row.getCell(2).value = { text: url, hyperlink: url };
    row.getCell(2).font = { color: { argb: "FF0C7A3E" }, underline: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function buildListExcel(inscricoes: Inscricao[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mix Models";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Perfis", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nome", key: "nome", width: 28 },
    { header: "Status", key: "status", width: 14 },
    { header: "Idade", key: "idade", width: 10 },
    { header: "Nascimento", key: "nascimento", width: 18 },
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Instagram", key: "instagram", width: 22 },
    { header: "Link Instagram", key: "instagram_url", width: 32 },
    { header: "Endereço", key: "endereco", width: 40 },
    { header: "Altura", key: "altura", width: 12 },
    { header: "Cintura", key: "cintura", width: 12 },
    { header: "Quadril", key: "quadril", width: 12 },
    { header: "Busto", key: "busto", width: 12 },
    { header: "Tatuagens/piercings", key: "tatuagens", width: 28 },
    { header: "Experiência", key: "experiencia", width: 36 },
    { header: "Inscrita em", key: "inscrita", width: 20 },
    { header: "Foto 1", key: "foto1", width: 28 },
    { header: "Foto 2", key: "foto2", width: 28 },
    { header: "Foto 3", key: "foto3", width: 28 },
    { header: "Foto 4", key: "foto4", width: 28 },
    { header: "Foto 5", key: "foto5", width: 28 },
  ];
  styleHeader(sheet.getRow(1));

  for (const perfil of inscricoes) {
    const years = idade(perfil.data_nascimento);
    const row = sheet.addRow({
      nome: perfil.nome_completo,
      status: STATUS_LABEL[perfil.status],
      idade: years ?? "",
      nascimento: formatDate(perfil.data_nascimento),
      telefone: perfil.telefone,
      email: perfil.email,
      instagram: perfil.instagram,
      instagram_url: instagramUrl(perfil.instagram),
      endereco: perfil.endereco,
      altura: perfil.altura,
      cintura: perfil.cintura,
      quadril: perfil.quadril,
      busto: perfil.busto ?? "",
      tatuagens: perfil.tatuagens_piercings,
      experiencia: perfil.experiencia ?? "",
      inscrita: formatDateTime(perfil.created_at),
      foto1: perfil.fotos[0] ?? "",
      foto2: perfil.fotos[1] ?? "",
      foto3: perfil.fotos[2] ?? "",
      foto4: perfil.fotos[3] ?? "",
      foto5: perfil.fotos[4] ?? "",
    });
    row.alignment = { vertical: "top", wrapText: true };

    for (const key of ["instagram_url", "foto1", "foto2", "foto3", "foto4", "foto5"] as const) {
      const value = String(row.getCell(key).value ?? "");
      if (!value) continue;
      row.getCell(key).value = { text: value, hyperlink: value };
      row.getCell(key).font = { color: { argb: "FF0C7A3E" }, underline: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
