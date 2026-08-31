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
import { importLeadsMeta, listLeadsMeta, removeLeadMeta } from "@/lib/leads-meta";
import { leadWhatsappEnviado } from "@/lib/lead-meta-status";
import { parseMetaLeadsCsv } from "@/lib/meta-csv";
import { sendProfileEmail } from "@/lib/export/email";
import { buildProfileExcel } from "@/lib/export/excel";
import { fileBaseName } from "@/lib/export/fields";
import { mailConfigError } from "@/lib/export/mail-config";
import { zapiConfigError, listZapiChats, whatsappDigits } from "@/lib/z-api";
import { podeLiberarFila, whatsappMonitor } from "@/lib/whatsapp-fila";
import { enviarProximoWhatsapp, processarFilaWhatsapp } from "@/lib/whatsapp-enviar";
import {
  desmarcarWhatsappLeads,
  getWhatsappFilaEstado,
  setWhatsappAuto,
  setWhatsappModo,
} from "@/lib/whatsapp-fila-server";
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

export async function whatsappLeadMetaFotos(id: string) {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const result = await enviarProximoWhatsapp(id);
  if ("ok" in result) revalidatePath("/admin");
  return result;
}

export async function whatsappLeadsMetaPendentes() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const auto = await setWhatsappAuto(true);
  const result = await enviarProximoWhatsapp();
  revalidatePath("/admin");
  if ("ok" in result) {
    return {
      ok: true as const,
      enviados: 1,
      restantes: result.restantes,
      to: result.to,
      nome: result.nome,
      piloto: result.piloto,
      limite: result.limite,
      modo: result.modo,
      esperaMinutos: result.esperaMinutos,
      falhas: 0,
    };
  }
  if (auto.error === "sql-missing") {
    return result;
  }
  const erro = result.error ?? "Não foi possível enviar agora.";
  const esperaOuHorario =
    /Espere |horário|Domingo|Sábado|Piloto concluído|não manda|Fora do horário|conversa real/i.test(
      erro,
    );
  if (!esperaOuHorario) {
    return { error: erro };
  }
  return {
    ok: true as const,
    enviados: 0,
    restantes: undefined,
    to: undefined,
    nome: undefined,
    piloto: undefined,
    limite: undefined,
    modo: undefined,
    esperaMinutos: undefined,
    falhas: 0,
    aviso: erro,
  };
}

export async function whatsappTickFila() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const result = await processarFilaWhatsapp();
  revalidatePath("/admin");
  return result;
}

export async function whatsappLiberarFila() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const { data, error } = await listLeadsMeta();
  if (error) return { error: error === "sql-missing" ? "Falta rodar o SQL do WhatsApp." : error };
  const estado = await getWhatsappFilaEstado(data);
  const monitor = whatsappMonitor(data);
  if (!podeLiberarFila(estado, monitor)) {
    return {
      error:
        "Ainda não. Termine o piloto de 10, veja entregue/lido e se ninguém pediu SAIR em massa.",
    };
  }
  const updated = await setWhatsappModo("liberado");
  if (updated.error === "sql-missing") {
    return {
      error:
        "Rode supabase/whatsapp-fila.sql no SQL Editor. Sem isso a liberação não grava.",
    };
  }
  if (updated.error) return { error: updated.error };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function whatsappPausarFila() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const updated = await setWhatsappModo("pausado");
  if (updated.error === "sql-missing") {
    return { error: "Rode supabase/whatsapp-fila.sql no SQL Editor." };
  }
  if (updated.error) return { error: updated.error };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function whatsappRetomarFila() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const { data, error } = await listLeadsMeta();
  if (error) {
    return { error: error === "sql-missing" ? "Falta rodar o SQL do WhatsApp." : error };
  }
  const estado = await getWhatsappFilaEstado(data);
  if (estado.modo !== "pausado") {
    return { error: "A fila não está pausada." };
  }
  const next =
    estado.modoAntesPausa === "liberado" || estado.modoAntesPausa === "piloto"
      ? estado.modoAntesPausa
      : "piloto";
  const updated = await setWhatsappModo(next);
  if (updated.error === "sql-missing") {
    return { error: "Rode supabase/whatsapp-fila.sql no SQL Editor." };
  }
  if (updated.error) return { error: updated.error };
  await setWhatsappAuto(true);
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function whatsappReconciliarNaoEnviados() {
  if (!(await isAdmin())) {
    return { error: "Sessão expirada. Entre de novo." };
  }
  const configError = zapiConfigError();
  if (configError) return { error: configError };

  const { data, error } = await listLeadsMeta();
  if (error) {
    return {
      error:
        error === "sql-missing"
          ? "Falta rodar o SQL dos leads no Supabase."
          : error,
    };
  }

  let chats: Awaited<ReturnType<typeof listZapiChats>> = [];
  try {
    chats = await listZapiChats();
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Não foi possível ler os chats da Z-API.",
    };
  }

  const chatKeys = new Set(
    chats
      .filter((item) => !item.isGroup)
      .map((item) => whatsappDigits(item.phone ?? "").slice(-8))
      .filter((item) => item.length >= 8),
  );

  const marcados = data.filter(leadWhatsappEnviado);
  const manter = marcados.filter((item) => {
    const key = whatsappDigits(item.telefone).slice(-8);
    if (key && chatKeys.has(key)) return true;
    return item.email_status === "entregue" || item.email_status === "lido";
  });
  const voltar = marcados.filter(
    (item) => !manter.some((keep) => keep.id === item.id),
  );
  const unmarked = await desmarcarWhatsappLeads(voltar.map((item) => item.id));
  if (unmarked.sqlMissing) {
    return {
      error:
        "Rode supabase/whatsapp-fila.sql no SQL Editor. Depois clique de novo para devolver as não enviadas à fila.",
    };
  }
  if (unmarked.error) return { error: unmarked.error };

  revalidatePath("/admin");
  return {
    ok: true as const,
    mantidos: manter.length,
    voltaram: unmarked.n,
  };
}
