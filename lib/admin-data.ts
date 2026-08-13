import { supabase } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-auth";
import {
  type Inscricao,
  type InscricaoStatus,
  normalizeStatus,
} from "@/lib/inscricao";

function mapInscricao(row: Inscricao): Inscricao {
  return {
    ...row,
    fotos: Array.isArray(row.fotos) ? row.fotos : [],
    status: normalizeStatus(row.status),
  };
}

export async function listInscricoes(): Promise<{
  data: Inscricao[];
  error?: "sql-missing" | "secret-mismatch" | "env" | string;
}> {
  let secret: string;
  try {
    secret = getAdminSecret();
  } catch {
    return { data: [], error: "env" };
  }

  const { data, error } = await supabase.rpc("admin_listar_inscricoes", {
    p_secret: secret,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      error.code === "PGRST202" ||
      message.includes("could not find the function")
    ) {
      return { data: [], error: "sql-missing" };
    }
    if (error.code === "42501" || message.includes("unauthorized")) {
      return { data: [], error: "secret-mismatch" };
    }
    return { data: [], error: error.message };
  }

  return { data: ((data ?? []) as Inscricao[]).map(mapInscricao) };
}

export async function getInscricao(id: string): Promise<Inscricao | null> {
  const { data, error } = await supabase.rpc("admin_obter_inscricao", {
    p_secret: getAdminSecret(),
    p_id: id,
  });

  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Inscricao | undefined;
  if (!row) return null;
  return mapInscricao(row);
}

export async function setInscricaoStatus(
  id: string,
  status: InscricaoStatus,
): Promise<{ data?: Inscricao; error?: string }> {
  const { data, error } = await supabase.rpc("admin_atualizar_status", {
    p_secret: getAdminSecret(),
    p_id: id,
    p_status: status,
  });

  if (error) return { error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Inscricao | undefined;
  if (!row) return { error: "Perfil não encontrado." };
  return { data: mapInscricao(row) };
}
