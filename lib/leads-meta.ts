import { supabase } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-auth";
import type { MetaLeadParsed } from "@/lib/meta-csv";

export type LeadMeta = {
  id: string;
  meta_lead_id: string;
  created_at: string;
  imported_at: string;
  nome_completo: string;
  email: string;
  telefone: string;
  cidade: string | null;
  endereco: string | null;
  instagram: string | null;
  data_nascimento: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  formulario: string | null;
  plataforma: string | null;
  extras: Record<string, string>;
  fotos: string[];
  email_fotos_em: string | null;
  email_resend_id: string | null;
  email_status: string | null;
  email_entregue_em: string | null;
  email_lido_em: string | null;
  email_clicou_em: string | null;
  inscricao_id: string | null;
};

function mapLead(row: LeadMeta): LeadMeta {
  return {
    ...row,
    extras:
      row.extras && typeof row.extras === "object" && !Array.isArray(row.extras)
        ? row.extras
        : {},
    fotos: Array.isArray(row.fotos) ? row.fotos : [],
    email_fotos_em: row.email_fotos_em ?? null,
    email_resend_id: row.email_resend_id ?? null,
    email_status: row.email_status ?? null,
    email_entregue_em: row.email_entregue_em ?? null,
    email_lido_em: row.email_lido_em ?? null,
    email_clicou_em: row.email_clicou_em ?? null,
    inscricao_id: row.inscricao_id ?? null,
  };
}

function rpcError(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();
  if (
    error.code === "PGRST202" ||
    message.includes("could not find the function")
  ) {
    return "sql-missing" as const;
  }
  if (error.code === "42501" || message.includes("unauthorized")) {
    return "secret-mismatch" as const;
  }
  if (error.code === "P0002" || message.includes("not found")) {
    return "Lead não encontrado.";
  }
  return error.message;
}

export async function listLeadsMeta(): Promise<{
  data: LeadMeta[];
  error?: "sql-missing" | "secret-mismatch" | string;
}> {
  let secret: string;
  try {
    secret = getAdminSecret();
  } catch {
    return { data: [], error: "env" };
  }

  const { data, error } = await supabase.rpc("admin_listar_leads_meta", {
    p_secret: secret,
  });

  if (error) return { data: [], error: rpcError(error) };
  return { data: ((data ?? []) as LeadMeta[]).map(mapLead) };
}

export async function importLeadsMeta(leads: MetaLeadParsed[]): Promise<{
  inseridos?: number;
  atualizados?: number;
  error?: "sql-missing" | "secret-mismatch" | string;
}> {
  const { data, error } = await supabase.rpc("admin_importar_leads_meta", {
    p_secret: getAdminSecret(),
    p_leads: leads,
  });

  if (error) return { error: rpcError(error) };
  const result = (Array.isArray(data) ? data[0] : data) as {
    inseridos?: number;
    atualizados?: number;
  } | null;
  return {
    inseridos: Number(result?.inseridos) || 0,
    atualizados: Number(result?.atualizados) || 0,
  };
}

export async function removeLeadMeta(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("admin_excluir_lead_meta", {
    p_secret: getAdminSecret(),
    p_id: id,
  });
  if (error) return { error: rpcError(error) };
  return {};
}

export async function markLeadsMetaEmailEnviado(
  items: Array<{ id: string; emailId?: string | null }>,
): Promise<{
  error?: "sql-missing" | "secret-mismatch" | string;
}> {
  if (items.length === 0) return {};
  const { error } = await supabase.rpc("admin_marcar_email_fotos", {
    p_secret: getAdminSecret(),
    p_items: items.map((item) => ({
      id: item.id,
      email_id: item.emailId ?? "",
    })),
  });
  if (error) return { error: rpcError(error) };
  return {};
}

export async function applyLeadEmailEvent(options: {
  emailId: string;
  evento: string;
  leadId?: string | null;
  at?: string | null;
}): Promise<{
  error?: "sql-missing" | "secret-mismatch" | string;
}> {
  const { error } = await supabase.rpc("admin_evento_email_lead", {
    p_secret: getAdminSecret(),
    p_email_id: options.emailId || "",
    p_evento: options.evento,
    p_lead_id: options.leadId || null,
    p_at: options.at || new Date().toISOString(),
  });
  if (error) return { error: rpcError(error) };
  return {};
}
