import { readFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import {
  STATUS_LABEL,
  formatDate,
  formatDateTime,
  idade,
  type Inscricao,
} from "@/lib/inscricao";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const DEEP = rgb(0.016, 0.09, 0.059);
const GREEN = rgb(0.047, 0.478, 0.243);
const LIME = rgb(0.784, 0.922, 0.294);
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.38, 0.38, 0.38);
const LINE = rgb(0.9, 0.9, 0.88);

function toWinAnsi(text: string) {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (char === "\n" || char === "\r") return " ";
      if (code === 0x2018 || code === 0x2019) return "'";
      if (code === 0x201c || code === 0x201d) return '"';
      if (code === 0x2013 || code === 0x2014) return "-";
      if (code === 0x2026) return "...";
      if (code === 0xa0) return " ";
      if (code >= 0x20 && code <= 0x7e) return char;
      if (code >= 0xa0 && code <= 0xff) return char;
      const stripped = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (stripped && stripped.charCodeAt(0) < 127) return stripped;
      return "?";
    })
    .join("");
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const safe = toWinAnsi(text).trim() || "—";
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushChunk = (chunk: string) => {
    if (!chunk) return;
    if (font.widthOfTextAtSize(chunk, size) <= maxWidth) {
      current = current ? `${current} ${chunk}` : chunk;
      if (font.widthOfTextAtSize(current, size) > maxWidth) {
        const parts = current.split(" ");
        const last = parts.pop() ?? "";
        const prev = parts.join(" ");
        if (prev) lines.push(prev);
        current = last;
      }
      return;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    let piece = "";
    for (const letter of chunk) {
      const next = piece + letter;
      if (font.widthOfTextAtSize(next, size) > maxWidth && piece) {
        lines.push(piece);
        piece = letter;
      } else {
        piece = next;
      }
    }
    current = piece;
  };

  for (const word of words) pushChunk(word);
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

async function embedPhoto(pdf: PDFDocument, url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const lower = url.toLowerCase();

    const tryJpg = () => pdf.embedJpg(bytes);
    const tryPng = () => pdf.embedPng(bytes);

    if (type.includes("png") || lower.includes(".png")) {
      try {
        return await tryPng();
      } catch {
        return null;
      }
    }
    if (type.includes("jpeg") || type.includes("jpg") || /\.jpe?g(\?|$)/.test(lower)) {
      try {
        return await tryJpg();
      } catch {
        return null;
      }
    }
    try {
      return await tryJpg();
    } catch {
      try {
        return await tryPng();
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

function drawHeaderBar(page: PDFPage, fontBold: PDFFont, logo?: PDFImage) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: DEEP });
  page.drawRectangle({ x: 0, y: height - 90, width, height: 4, color: LIME });
  page.drawText(toWinAnsi("PROCESSO SELETIVO"), {
    x: MARGIN,
    y: height - 38,
    size: 9,
    font: fontBold,
    color: LIME,
  });
  page.drawText(toWinAnsi("Agnes Pimentel  ·  Mix Models  ·  Instituto Imperatriz"), {
    x: MARGIN,
    y: height - 62,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  if (logo) {
    const scaled = logo.scaleToFit(58, 58);
    page.drawImage(logo, {
      x: width - MARGIN - scaled.width,
      y: height - 78,
      width: scaled.width,
      height: scaled.height,
    });
  }
}

function drawFooter(page: PDFPage, font: PDFFont, pageIndex: number, total: number) {
  page.drawText(
    toWinAnsi(`Ficha confidencial  ·  página ${pageIndex} de ${total}`),
    {
      x: MARGIN,
      y: 24,
      size: 8,
      font,
      color: MUTED,
    },
  );
}

export async function buildProfilePdf(perfil: Inscricao) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ficha — ${perfil.nome_completo}`);
  pdf.setAuthor("Mix Models × Instituto Imperatriz");
  pdf.setCreator("Processo Seletivo Agnes Pimentel");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | undefined;
  try {
    const logoBytes = await readFile(
      path.join(process.cwd(), "public/logo-imperatriz.png"),
    );
    logo = await pdf.embedPng(logoBytes);
  } catch {
    logo = undefined;
  }

  const photos = (
    await Promise.all(perfil.fotos.map((url) => embedPhoto(pdf, url)))
  ).filter((image): image is NonNullable<typeof image> => image !== null);

  const pages: PDFPage[] = [];
  const addPage = () => {
    const page = pdf.addPage([A4.width, A4.height]);
    pages.push(page);
    drawHeaderBar(page, fontBold, logo);
    return page;
  };

  let page = addPage();
  let y = A4.height - 118;
  const maxWidth = A4.width - MARGIN * 2;

  const ensure = (space: number) => {
    if (y - space < 56) {
      page = addPage();
      y = A4.height - 118;
    }
  };

  const write = (
    text: string,
    size: number,
    color: RGB,
    bold = false,
    gap = 4,
  ) => {
    const used = bold ? fontBold : font;
    const lines = wrapText(text, used, size, maxWidth);
    for (const line of lines) {
      ensure(size + 6);
      page.drawText(line, { x: MARGIN, y, size, font: used, color });
      y -= size + gap;
    }
  };

  const years = idade(perfil.data_nascimento);
  write(perfil.nome_completo, 22, INK, true, 6);
  write(
    `${STATUS_LABEL[perfil.status]}  ·  ${
      years !== null ? `${years} anos` : formatDate(perfil.data_nascimento)
    }  ·  inscrita em ${formatDateTime(perfil.created_at)}`,
    10,
    MUTED,
    false,
    10,
  );

  y -= 6;
  page.drawRectangle({
    x: MARGIN,
    y: y + 8,
    width: maxWidth,
    height: 1,
    color: LINE,
  });
  y -= 8;

  const fields: Array<[string, string]> = [
    ["Telefone", perfil.telefone],
    ["E-mail", perfil.email],
    ["Instagram", perfil.instagram],
    ["Nascimento", formatDate(perfil.data_nascimento)],
    ["Endereço", perfil.endereco],
    ["Altura", perfil.altura],
    ["Cintura", perfil.cintura],
    ["Quadril", perfil.quadril],
    ["Busto", perfil.busto || "—"],
    ["Tatuagens ou piercings", perfil.tatuagens_piercings],
    ["Experiência", perfil.experiencia || "Não informada"],
  ];

  const colGap = 16;
  const colWidth = (maxWidth - colGap) / 2;
  let leftY = y;
  let rightY = y;
  let useLeft = true;

  for (const [label, value] of fields) {
    const isWide =
      label === "Endereço" ||
      label === "Tatuagens ou piercings" ||
      label === "Experiência";
    const width = isWide ? maxWidth : colWidth;
    const startY = isWide ? Math.min(leftY, rightY) : useLeft ? leftY : rightY;
    const labelSize = 8;
    const valueSize = 10;
    const valueLines = wrapText(value, font, valueSize, width);
    const blockHeight = labelSize + 4 + valueLines.length * (valueSize + 3) + 14;

    if (startY - blockHeight < 56) {
      page = addPage();
      leftY = A4.height - 118;
      rightY = leftY;
    }

    const drawY = isWide ? Math.min(leftY, rightY) : useLeft ? leftY : rightY;
    const cursorX = isWide || useLeft ? MARGIN : MARGIN + colWidth + colGap;
    let cursor = drawY;
    page.drawText(toWinAnsi(label.toUpperCase()), {
      x: cursorX,
      y: cursor,
      size: labelSize,
      font: fontBold,
      color: GREEN,
    });
    cursor -= labelSize + 4;
    for (const line of valueLines) {
      page.drawText(line, {
        x: cursorX,
        y: cursor,
        size: valueSize,
        font,
        color: INK,
      });
      cursor -= valueSize + 3;
    }
    cursor -= 10;

    if (isWide) {
      leftY = cursor;
      rightY = cursor;
      useLeft = true;
    } else if (useLeft) {
      leftY = cursor;
      useLeft = false;
    } else {
      rightY = cursor;
      useLeft = true;
    }
  }

  y = Math.min(leftY, rightY) - 8;

  if (photos.length > 0) {
    ensure(28);
    write("Book fotográfico", 12, GREEN, true, 12);

    const perRow = 3;
    const gap = 10;
    const photoWidth = (maxWidth - gap * (perRow - 1)) / perRow;
    const photoHeight = photoWidth * (4 / 3);

    for (let index = 0; index < photos.length; index += 1) {
      const column = index % perRow;
      if (column === 0) ensure(photoHeight + 12);
      const x = MARGIN + column * (photoWidth + gap);
      const image = photos[index];
      const scaled = image.scaleToFit(photoWidth, photoHeight);
      page.drawImage(image, {
        x,
        y: y - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      if (column === perRow - 1 || index === photos.length - 1) {
        y -= photoHeight + 12;
      }
    }
  }

  pages.forEach((item, index) => {
    drawFooter(item, font, index + 1, pages.length);
  });

  return pdf.save();
}
