"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearAdminCookie,
  isAdmin,
  safeAdminPath,
  setAdminCookie,
} from "@/lib/admin-auth";
import { getInscricao, removeInscricao, setInscricaoStatus } from "@/lib/admin-data";
import { importLeadsMeta, removeLeadMeta } from "@/lib/leads-meta";
import { parseMetaLeadsCsv } from "@/lib/meta-csv";
import { sendProfileEmail } from "@/lib/export/email";
import { buildProfileExcel } from "@/lib/export/excel";
import { fileBaseName } from "@/lib/export/fields";
import { mailConfigError } from "@/lib/export/mail-config";
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
