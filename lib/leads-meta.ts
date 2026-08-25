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
};

function mapLead(row: LeadMeta): LeadMeta {
  return {
    ...row,
    extras:
      row.extras && typeof row.extras === "object" && !Array.isArray(row.extras)
        ? row.extras
        : {},
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
