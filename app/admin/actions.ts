"use server";

export const maxDuration = 300;

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearAdminCookie,
  isAdmin,
  safeAdminPath,
  setAdminCookie,
} from "@/lib/admin-auth";
import { getInscricao, removeInscricao, setInscricaoStatus } from "@/lib/admin-data";
import { importLeadsMeta, listLeadsMeta, markLeadsMetaEmailEnviado, removeLeadMeta } from "@/lib/leads-meta";
import { leadMetaConfirmado, leadTemWhatsapp, leadWhatsappEnviado } from "@/lib/lead-meta-status";
import { parseMetaLeadsCsv } from "@/lib/meta-csv";
import { sendProfileEmail } from "@/lib/export/email";
import { leadFotosWhatsappMessage } from "@/lib/export/lead-fotos-whatsapp";
import { buildProfileExcel } from "@/lib/export/excel";
import { fileBaseName } from "@/lib/export/fields";
import { mailConfigError } from "@/lib/export/mail-config";
import { sendZapiText, zapiConfigError } from "@/lib/z-api";
import { buildProfilePdf } from "@/lib/export/pdf";
import {
  type InscricaoStatus,
  normalizeStatus,
} from "@/lib/inscricao";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "ADMIN_PASSWORD não está definido no .env.local." };
  }

  if (password !== expected) {
    return { error: "Senha incorreta." };
  }

  await setAdminCookie();
  redirect(safeAdminPath(String(formData.get("next") ?? "")));
}

export async function logoutAdmin() {
  await clearAdminCookie();
  redirect("/admin/login");
}

export async function updateStatus(id: string, status: string) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const normalized = normalizeStatus(status) as InscricaoStatus;
  if (normalized !== status) {
    return { error: "Status inválido." };
  }

  const result = await setInscricaoStatus(id, normalized);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  return { ok: true };
}

export async function deleteInscricao(id: string, stayOnList = false) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const result = await removeInscricao(id);
  if (result.error === "sql-missing") {
    return {
      error:
        "Falta um passo no banco. Abra o SQL Editor do Supabase, rode o arquivo supabase/excluir.sql e tente de novo.",
    };
  }
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  revalidatePath(`/acompanhar/${id}`);

  if (!stayOnList) {
    redirect("/admin");
  }

  return { ok: true };
}

export async function emailProfile(id: string) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const configError = mailConfigError();
  if (configError) {
    return { error: configError };
  }

  const perfil = await getInscricao(id);
  if (!perfil) {
    return { error: "Perfil não encontrado." };
  }

  try {
    const base = fileBaseName(perfil);
    const [pdf, excel] = await Promise.all([
      buildProfilePdf(perfil),
      buildProfileExcel(perfil),
    ]);

    const result = await sendProfileEmail({
      perfil,
      pdf,
      excel,
      pdfName: `${base}.pdf`,
      excelName: `${base}.xlsx`,
    });

    return { ok: true, to: result.to };
  } catch (error) {
    console.error(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o e-mail agora.",
    };
  }
}

const MAX_CSV_BYTES = 6 * 1024 * 1024;

export async function importMetaCsv(formData: FormData) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Escolha o arquivo CSV baixado da Meta." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { error: "O CSV pode ter no máximo 6 MB." };
  }

  const buffer = await file.arrayBuffer();
  const parsed = parseMetaLeadsCsv(buffer);
  if (parsed.error) {
    return { error: parsed.error };
  }
  if (parsed.leads.length === 0) {
    return { error: "Não achei nenhum lead com nome nesse CSV." };
  }

  const result = await importLeadsMeta(parsed.leads);
  if (result.error === "sql-missing") {
    return {
      error:
        "Falta um passo no banco. Abra o SQL Editor do Supabase, rode o arquivo supabase/leads-meta.sql e tente de novo.",
    };
  }
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  return {
    ok: true as const,
    inseridos: result.inseridos ?? 0,
    atualizados: result.atualizados ?? 0,
    ignorados: parsed.skipped,
  };
}

export async function deleteLeadMeta(id: string) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const result = await removeLeadMeta(id);
  if (result.error === "sql-missing") {
    return {
      error:
        "Falta um passo no banco. Rode o arquivo supabase/leads-meta.sql no SQL Editor do Supabase.",
    };
  }
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  return { ok: true };
}

const WHATSAPP_BATCH = 15;
const PAUSA_ENTRE_ENVIOS_MS = { min: 800, max: 1800 };
const PAUSA_A_CADA = 5;
const PAUSA_EXTRA_MS = { min: 8000, max: 15000 };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomMs(range: { min: number; max: number }) {
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}

export async function whatsappLeadMetaFotos(id: string) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const configError = zapiConfigError();
  if (configError) return { error: configError };

  const { data, error } = await listLeadsMeta();
  if (error) return { error: error === "sql-missing" ? "Falta rodar supabase/leads-meta-fotos.sql no Supabase." : error };

  const lead = data.find((item) => item.id === id);
  if (!lead) return { error: "Lead não encontrado." };
  if (leadMetaConfirmado(lead)) {
    return { error: "Esse cadastro já está confirmado com fotos." };
  }
  if (!leadTemWhatsapp(lead)) {
    return { error: "Esse lead não tem WhatsApp." };
  }

  let messageId: string | null = null;
  try {
    const sent = await sendZapiText({
      phone: lead.telefone,
      message: leadFotosWhatsappMessage(lead.nome_completo, lead.id),
    });
    messageId = sent.id ? `wa:${sent.id}` : "wa:";
  } catch (caught) {
    console.error(caught);
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar o WhatsApp agora.",
    };
  }

  const marked = await markLeadsMetaEmailEnviado([
    { id: lead.id, emailId: messageId },
  ]);
  if (marked.error && marked.error !== "sql-missing") {
    return { error: marked.error };
  }

  revalidatePath("/admin");
  return { ok: true as const, to: lead.telefone };
}

export async function whatsappLeadsMetaPendentes() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }

  const configError = zapiConfigError();
  if (configError) return { error: configError };

  const { data, error } = await listLeadsMeta();
  if (error) return { error: error === "sql-missing" ? "Falta rodar supabase/leads-meta-fotos.sql no Supabase." : error };

  const fila = data.filter(
    (item) =>
      !leadMetaConfirmado(item) &&
      leadTemWhatsapp(item) &&
      !leadWhatsappEnviado(item),
  );
  const lote = fila.slice(0, WHATSAPP_BATCH);
  if (lote.length === 0) {
    return { error: "Não há pendentes com WhatsApp esperando o pedido de fotos." };
  }

  const sentItems: Array<{ id: string; emailId: string | null }> = [];
  const falhas: string[] = [];
  for (const [index, lead] of lote.entries()) {
    if (index > 0) {
      await sleep(randomMs(PAUSA_ENTRE_ENVIOS_MS));
      if (index % PAUSA_A_CADA === 0) {
        await sleep(randomMs(PAUSA_EXTRA_MS));
      }
    }
    try {
      const sent = await sendZapiText({
        phone: lead.telefone,
        message: leadFotosWhatsappMessage(lead.nome_completo, lead.id),
      });
      sentItems.push({ id: lead.id, emailId: sent.id ? `wa:${sent.id}` : "wa:" });
    } catch (caught) {
      console.error(caught);
      falhas.push(lead.nome_completo);
    }
  }

  if (sentItems.length > 0) {
    const marked = await markLeadsMetaEmailEnviado(sentItems);
    if (marked.error && marked.error !== "sql-missing") {
      return { error: marked.error };
    }
  }

  if (sentItems.length === 0) {
    return {
      error: falhas.length
        ? `Nenhuma mensagem saiu. Confira a instância do Z-API. Falhou: ${falhas.slice(0, 3).join(", ")}.`
        : "Não foi possível enviar o lote agora.",
    };
  }

  revalidatePath("/admin");
  return {
    ok: true as const,
    enviados: sentItems.length,
    restantes: Math.max(0, fila.length - lote.length),
    falhas: falhas.length,
  };
}
