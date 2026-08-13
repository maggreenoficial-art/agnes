import { supabase } from "@/lib/supabase";
import {
  normalizeStatus,
  type InscricaoStatus,
} from "@/lib/inscricao";

export type Acompanhamento = {
  id: string;
  nome_completo: string;
  status: InscricaoStatus;
  created_at: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTrackingId(value: string) {
  return UUID.test(value);
}

export async function getAcompanhamento(
  id: string,
): Promise<Acompanhamento | null> {
  if (!isTrackingId(id)) return null;

  const { data, error } = await supabase.rpc("acompanhar_inscricao", {
    p_id: id,
  });

  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        id: string;
        nome_completo: string;
        status: string;
        created_at: string;
      }
    | undefined;
  if (!row?.id) return null;

  return {
    id: row.id,
    nome_completo: row.nome_completo,
    status: normalizeStatus(row.status),
    created_at: row.created_at,
  };
}
