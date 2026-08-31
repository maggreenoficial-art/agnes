import { leadFotosWhatsappMessage } from "@/lib/export/lead-fotos-whatsapp";
import {
  leadMetaConfirmado,
  leadTemWhatsapp,
  leadWhatsappEnviado,
  leadWhatsappSaiu,
} from "@/lib/lead-meta-status";
import {
  listLeadsMeta,
  markLeadsMetaEmailEnviado,
} from "@/lib/leads-meta";
import {
  avaliacaoPosPiloto,
  bloqueioEnvio,
  filaWhatsapp,
  randomIntervaloSeg,
  whatsappHorarioError,
  whatsappMonitor,
} from "@/lib/whatsapp-fila";
import {
  claimWhatsappTick,
  getWhatsappFilaEstado,
  registrarEnvioWhatsapp,
  registrarMensagemWhatsapp,
  setWhatsappModo,
} from "@/lib/whatsapp-fila-server";
import { sendZapiText, zapiConfigError } from "@/lib/z-api";

export async function enviarProximoWhatsapp(id?: string, options?: { ignoreEspera?: boolean }) {
  const configError = zapiConfigError();
  if (configError) return { error: configError };

  const { data, error } = await listLeadsMeta();
  if (error) {
    return {
      error:
        error === "sql-missing"
          ? "Falta rodar supabase/leads-meta-fotos.sql no Supabase."
          : error,
    };
  }

  const estado = await getWhatsappFilaEstado(data);
  const bloqueio = bloqueioEnvio(estado);
  if (bloqueio) {
    if (!options?.ignoreEspera) return { error: bloqueio };
    if (estado.modo === "pausado") return { error: bloqueio };
    if (estado.modo === "piloto" && estado.pilotoEnviados >= estado.pilotoLimite) {
      return { error: bloqueio };
    }
    const horario = whatsappHorarioError();
    if (horario) return { error: horario };
  }

  const fila = filaWhatsapp(data);
  const lead = id ? data.find((item) => item.id === id) : fila[0];
  if (!lead) return { error: "Lead não encontrado." };
  if (leadMetaConfirmado(lead)) {
    return { error: "Esse cadastro já está confirmado com fotos." };
  }
  if (!leadTemWhatsapp(lead)) {
    return { error: "Esse lead não tem WhatsApp." };
  }
  if (leadWhatsappEnviado(lead)) {
    return { error: "Esse lead já recebeu o convite no WhatsApp." };
  }
  if (leadWhatsappSaiu(lead)) {
    return { error: "Essa pessoa pediu para sair. Não mandamos de novo." };
  }

  const texto = leadFotosWhatsappMessage(lead.nome_completo, lead.id);
  let messageId: string | null = null;
  let zapiId: string | null = null;
  try {
    const sent = await sendZapiText({
      phone: lead.telefone,
      message: texto,
    });
    zapiId = sent.id;
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

  await registrarMensagemWhatsapp({
    phone: lead.telefone,
    direcao: "out",
    texto,
    tipo: "text",
    messageId: zapiId,
    leadId: lead.id,
  });

  const intervaloSeg = randomIntervaloSeg();
  await registrarEnvioWhatsapp(intervaloSeg);
  return {
    ok: true as const,
    to: lead.telefone,
    nome: lead.nome_completo,
    restantes: fila.filter((item) => item.id !== lead.id).length,
    piloto: estado.pilotoEnviados + (estado.modo === "piloto" ? 1 : 0),
    limite: estado.pilotoLimite,
    modo: estado.modo,
    esperaMinutos: Math.ceil(intervaloSeg / 60),
  };
}

export async function processarFilaWhatsapp() {
  const { data, error } = await listLeadsMeta();
  if (error) return { skipped: error };
  let estado = await getWhatsappFilaEstado(data);
  if (!estado.autoEnvio) return { skipped: "auto-off" };

  if (estado.modo === "piloto" && estado.pilotoEnviados >= estado.pilotoLimite) {
    const avaliacao = avaliacaoPosPiloto(estado, whatsappMonitor(data));
    if (avaliacao.status !== "pronto") {
      return { skipped: avaliacao.mensagem ?? "piloto" };
    }
    const liberated = await setWhatsappModo("liberado");
    if (liberated.error) return { skipped: liberated.error };
    estado = await getWhatsappFilaEstado(data);
  }

  const bloqueio = bloqueioEnvio(estado);
  if (bloqueio) return { skipped: bloqueio };
  const claimed = await claimWhatsappTick();
  if (claimed.sqlMissing) {
    const sent = await enviarProximoWhatsapp(undefined, { ignoreEspera: true });
    return sent;
  }
  if ("error" in claimed && claimed.error) return { skipped: claimed.error };
  if (!claimed.claimed) return { skipped: "locked" };
  return enviarProximoWhatsapp(undefined, { ignoreEspera: true });
}
