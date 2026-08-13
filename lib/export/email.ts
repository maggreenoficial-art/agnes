import nodemailer from "nodemailer";
import { profileRows } from "@/lib/export/fields";
import { getExportEmail } from "@/lib/export/mail-config";
import type { Inscricao } from "@/lib/inscricao";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function profileHtml(perfil: Inscricao) {
  const rows = profileRows(perfil)
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-size:12px;color:#0c7a3e;font-weight:700;width:180px;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;font-size:14px;color:#111">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const photos = perfil.fotos
    .map(
      (url) =>
        `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0">
          <img src="${escapeHtml(url)}" alt="foto" width="120" height="160" style="object-fit:cover;border-radius:12px" />
        </a>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#04170f;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden">
        <div style="background:#04170f;padding:20px 24px;color:#c8eb4b;font-size:11px;letter-spacing:2px;font-weight:700">
          PROCESSO SELETIVO · MIX MODELS · INSTITUTO IMPERATRIZ
        </div>
        <div style="padding:24px">
          <h1 style="margin:0 0 8px;font-size:26px;color:#111">${escapeHtml(perfil.nome_completo)}</h1>
          <p style="margin:0 0 20px;color:#666;font-size:14px">Ficha completa em anexo (PDF e Excel).</p>
          <table style="width:100%;border-collapse:collapse">${rows}</table>
          <div style="margin-top:20px">${photos}</div>
        </div>
      </div>
    </div>
  `;
}

export async function sendProfileEmail(options: {
  perfil: Inscricao;
  pdf: Uint8Array;
  excel: Uint8Array;
  pdfName: string;
  excelName: string;
}) {
  const to = getExportEmail();
  const subject = `Ficha · ${options.perfil.nome_completo} · Processo Seletivo`;
  const html = profileHtml(options.perfil);
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "Processo Seletivo Agnes <beth.t@example.com>";

  const pdfContent = Buffer.from(options.pdf);
  const excelContent = Buffer.from(options.excel);

  if (process.env.RESEND_API_KEY?.trim()) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        attachments: [
          {
            filename: options.pdfName,
            content: pdfContent.toString("base64"),
          },
          {
            filename: options.excelName,
            content: excelContent.toString("base64"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Falha ao enviar com Resend.");
    }
    return { to };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS?.trim(),
    },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments: [
      {
        filename: options.pdfName,
        content: pdfContent,
        contentType: "application/pdf",
      },
      {
        filename: options.excelName,
        content: excelContent,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  return { to };
}
