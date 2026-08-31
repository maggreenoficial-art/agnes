import { getAdminSecret } from "@/lib/admin-auth";
import { leadWhatsappEnviado } from "@/lib/lead-meta-status";
import type { LeadMeta } from "@/lib/leads-meta";
import { supabase } from "@/lib/supabase";
import type { WhatsappFilaEstado, WhatsappModo } from "@/lib/whatsapp-fila";

function rpcMissing(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function")
  );
}

function parseModo(value: unknown): WhatsappModo | null {
  return value === "liberado" || value === "pausado" || value === "piloto"
    ? value
    : null;
}

function mapFila(row: {
  modo?: string;
  modo_antes_pausa?: string | null;
  piloto_limite?: number;
  piloto_enviados?: number;
  ultimo_envio_em?: string | null;
  proximo_intervalo_seg?: number;
  auto_envio?: boolean;
}): WhatsappFilaEstado {
  const modo = parseModo(row.modo) ?? "piloto";
  const ultimo = row.ultimo_envio_em ?? null;
  const intervalo = Number(row.proximo_intervalo_seg) || 300;
  const elapsed = ultimo
    ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 1000)
    : intervalo;
  return {
    modo,
    modoAntesPausa: parseModo(row.modo_antes_pausa),
    pilotoLimite: Number(row.piloto_limite) || 10,
    pilotoEnviados: Number(row.piloto_enviados) || 0,
    ultimoEnvioEm: ultimo,
    proximoIntervaloSeg: intervalo,
    esperaSeg: Math.max(0, intervalo - elapsed),
    autoEnvio: Boolean(row.auto_envio),
    sqlMissing: false,
  };
}

export async function getWhatsappFilaEstado(
  leads: LeadMeta[],
): Promise<WhatsappFilaEstado> {
  const { data, error } = await supabase.rpc("admin_whatsapp_fila", {
    p_secret: getAdminSecret(),
  });
  if (error) {
    if (!rpcMissing(error)) {
      throw new Error(error.message);
    }
    const enviados = leads.filter(leadWhatsappEnviado);
    const last = enviados
      .map((item) => item.email_fotos_em)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    const elapsed = last
      ? Math.floor((Date.now() - new Date(last).getTime()) / 1000)
      : 300;
    const piloto = enviados.filter((item) => {
      if (!item.email_fotos_em) return false;
      return new Date(item.email_fotos_em).getTime() > Date.now() - 36 * 60 * 60 * 1000;
    }).length;
    return {
      modo: process.env.WHATSAPP_FILA_LIBERADA === "1" ? "liberado" : "piloto",
      modoAntesPausa: null,
      pilotoLimite: 10,
      pilotoEnviados: Math.min(piloto, 10),
      ultimoEnvioEm: last,
      proximoIntervaloSeg: 300,
      esperaSeg: Math.max(0, 300 - elapsed),
      autoEnvio: false,
      sqlMissing: true,
    };
  }
  return mapFila((data ?? {}) as {
    modo?: string;
    modo_antes_pausa?: string | null;
    piloto_limite?: number;
    piloto_enviados?: number;
    ultimo_envio_em?: string | null;
    proximo_intervalo_seg?: number;
    auto_envio?: boolean;
  });
}

export async function registrarEnvioWhatsapp(intervaloSeg: number) {
  const { data, error } = await supabase.rpc("admin_whatsapp_registrar_envio", {
    p_secret: getAdminSecret(),
    p_intervalo_seg: intervaloSeg,
  });
  if (error && !rpcMissing(error)) throw new Error(error.message);
  return data;
}

export async function setWhatsappModo(modo: WhatsappModo) {
  const { error } = await supabase.rpc("admin_whatsapp_set_modo", {
    p_secret: getAdminSecret(),
    p_modo: modo,
  });
  if (error) {
    if (rpcMissing(error)) {
      return { error: "sql-missing" as const };
    }
    return { error: error.message };
  }
  return {};
}

export async function marcarWhatsappOptOut(phone: string) {
  const { data, error } = await supabase.rpc("admin_whatsapp_opt_out", {
    p_secret: getAdminSecret(),
    p_phone: phone,
  });
  if (error) {
    if (rpcMissing(error)) return { n: 0, sqlMissing: true as const };
    return { n: 0, error: error.message };
  }
  return { n: Number(data) || 0 };
}

export async function desmarcarWhatsappLeads(ids: string[]) {
  if (ids.length === 0) return { n: 0 };
  const { data, error } = await supabase.rpc("admin_whatsapp_desmarcar", {
    p_secret: getAdminSecret(),
    p_ids: ids,
  });
  if (error) {
    if (rpcMissing(error)) return { n: 0, sqlMissing: true as const };
    return { n: 0, error: error.message };
  }
  return { n: Number(data) || 0 };
}

export async function setWhatsappAuto(auto: boolean) {
  const { error } = await supabase.rpc("admin_whatsapp_set_auto", {
    p_secret: getAdminSecret(),
    p_auto: auto,
  });
  if (error) {
    if (rpcMissing(error)) return { error: "sql-missing" as const };
    return { error: error.message };
  }
  return {};
}

export async function claimWhatsappTick() {
  const { data, error } = await supabase.rpc("admin_whatsapp_claim_tick", {
    p_secret: getAdminSecret(),
  });
  if (error) {
    if (rpcMissing(error)) return { claimed: false, sqlMissing: true as const };
    return { claimed: false, error: error.message };
  }
  const row = (data ?? {}) as { claimed?: boolean };
  return { claimed: Boolean(row.claimed) };
}

export async function registrarMensagemWhatsapp(options: {
  phone: string;
  direcao: "out" | "in";
  texto: string;
  tipo?: string;
  messageId?: string | null;
  leadId?: string | null;
  at?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_whatsapp_registrar_mensagem", {
    p_secret: getAdminSecret(),
    p_phone: options.phone,
    p_direcao: options.direcao,
    p_texto: options.texto,
    p_tipo: options.tipo ?? "text",
    p_message_id: options.messageId || null,
    p_lead_id: options.leadId || null,
    p_at: options.at || new Date().toISOString(),
  });
  if (error) {
    if (rpcMissing(error)) return { sqlMissing: true as const };
    return { error: error.message };
  }
  const row = (data ?? {}) as { id?: string; lead_id?: string | null };
  return { id: row.id ?? null, leadId: row.lead_id ?? null };
}
