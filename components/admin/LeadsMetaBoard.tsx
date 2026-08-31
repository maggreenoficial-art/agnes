"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLeadMeta, whatsappLeadMetaFotos, whatsappLeadsMetaPendentes, whatsappLiberarFila, whatsappPausarFila, whatsappRetomarFila, whatsappReconciliarNaoEnviados, whatsappTickFila, importMetaCsv } from "@/app/admin/actions";
import { formatDateTime, instagramUrl, whatsappUrl } from "@/lib/inscricao";
import { leadMetaConfirmado, leadTemWhatsapp, leadWhatsappEnviado, leadWhatsappSaiu, leadWhatsappRespondeu, leadEmailStatus, leadEmailEntregue, leadEmailLido, leadEmailBounce } from "@/lib/lead-meta-status";
import type { LeadMeta } from "@/lib/leads-meta";
import { PhotoGallery } from "@/components/admin/PhotoGallery";
import { CopyLink } from "@/components/CopyLink";
import { leadFotosWhatsappMessage } from "@/lib/export/lead-fotos-whatsapp";
import { bloqueioEnvio, filaWhatsapp, podeLiberarFila, whatsappMonitor, type WhatsappFilaEstado } from "@/lib/whatsapp-fila";
import Link from "next/link";

type StatusFiltro =
  | "todas"
  | "pendente"
  | "confirmado"
  | "enviado"
  | "lido"
  | "respondeu"
  | "bounce"
  | "saiu";

function whatsappBadge(lead: LeadMeta) {
  if (leadWhatsappSaiu(lead)) {
    return { label: "Saiu", className: "bg-red-100 text-red-800" };
  }
  if (leadWhatsappRespondeu(lead)) {
    return { label: "Respondeu", className: "bg-lime text-ink" };
  }
  const status = leadEmailStatus(lead);
  if (!leadWhatsappEnviado(lead) || !status) return null;
  const styles: Record<string, { label: string; className: string }> = {
    enviado: { label: "Enviado", className: "bg-cream text-ink" },
    entregue: { label: "Entregue", className: "bg-ink/10 text-ink" },
    lido: { label: "Lido", className: "bg-gold/90 text-ink" },
    bounce: { label: "Não chegou", className: "bg-red-100 text-red-800" },
    falhou: { label: "Falhou", className: "bg-red-100 text-red-800" },
    reclamou: { label: "Saiu", className: "bg-red-100 text-red-800" },
  };
  return styles[status] ?? { label: "Enviado", className: "bg-cream text-ink" };
}

function extraLabel(key: string) {
  const normalized = key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("tatuag") || normalized.includes("piercing")) {
    return "Tatuagens / piercings";
  }
  if (normalized.includes("experiencia") || normalized.includes("modelo")) {
    return "Experiência como modelo";
  }
  return key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function extraEntries(extras: Record<string, string> | null | undefined) {
  if (!extras || typeof extras !== "object") return [];
  return Object.entries(extras).filter(
    ([key, value]) => value.trim() && !key.includes("instagram"),
  );
}

export function LeadsMetaBoard({
  leads,
  sqlMissing,
  zapiReady = false,
  filaEstado,
}: {
  leads: LeadMeta[];
  sqlMissing?: boolean;
  zapiReady?: boolean;
  filaEstado?: WhatsappFilaEstado | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [whatsappingId, setWhatsappingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFiltro>("pendente");

  const counts = useMemo(() => {
    const confirmado = leads.filter(leadMetaConfirmado).length;
    const fila = filaWhatsapp(leads);
    const enviados = leads.filter(leadWhatsappEnviado);
    return {
      todas: leads.length,
      confirmado,
      pendente: leads.length - confirmado,
      filaWhatsapp: fila.length,
      enviado: enviados.length,
      entregue: enviados.filter(leadEmailEntregue).length,
      lido: enviados.filter(leadEmailLido).length,
      bounce: enviados.filter(leadEmailBounce).length,
      saiu: leads.filter(leadWhatsappSaiu).length,
      respondeu: leads.filter(leadWhatsappRespondeu).length,
    };
  }, [leads]);

  const envios = useMemo(
    () =>
      leads
        .filter(leadWhatsappEnviado)
        .sort((a, b) =>
          (b.email_fotos_em ?? "").localeCompare(a.email_fotos_em ?? ""),
        ),
    [leads],
  );

  const estado: WhatsappFilaEstado = filaEstado ?? {
    modo: "piloto",
    modoAntesPausa: null,
    pilotoLimite: 10,
    pilotoEnviados: 0,
    ultimoEnvioEm: null,
    proximoIntervaloSeg: 300,
    esperaSeg: 0,
    autoEnvio: false,
    sqlMissing: true,
  };
  const monitor = useMemo(() => whatsappMonitor(leads), [leads]);
  const bloqueio = bloqueioEnvio(estado);
  const podeLiberar = podeLiberarFila(estado, monitor);
  const esperaMinutos = Math.ceil(estado.esperaSeg / 60);
  const soEspera = Boolean(
    estado.esperaSeg > 0 &&
      estado.modo !== "pausado" &&
      !(estado.modo === "piloto" && estado.pilotoEnviados >= estado.pilotoLimite),
  );

  useEffect(() => {
    if (!estado.autoEnvio || estado.modo === "pausado") return;
    let cancelled = false;
    async function pulse() {
      const result = await whatsappTickFila();
      if (cancelled) return;
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
      router.refresh();
    }
    const later = window.setTimeout(pulse, 2500);
    const id = window.setInterval(pulse, 20000);
    return () => {
      cancelled = true;
      window.clearTimeout(later);
      window.clearInterval(id);
    };
  }, [estado.autoEnvio, estado.modo, router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .filter((item) => {
        const confirmado = leadMetaConfirmado(item);
        const email = leadEmailStatus(item);
        if (filter === "pendente" && confirmado) return false;
        if (filter === "confirmado" && !confirmado) return false;
        if (filter === "enviado" && !leadWhatsappEnviado(item)) return false;
        if (filter === "lido" && (!leadWhatsappEnviado(item) || (email !== "lido" && email !== "clicou"))) {
          return false;
        }
        if (filter === "respondeu" && !leadWhatsappRespondeu(item)) return false;
        if (
          filter === "bounce" &&
          (!leadWhatsappEnviado(item) ||
            (email !== "bounce" && email !== "falhou"))
        ) {
          return false;
        }
        if (filter === "saiu" && !leadWhatsappSaiu(item)) return false;
        if (!needle) return true;
        return [
          item.nome_completo,
          item.email,
          item.telefone,
          item.instagram,
          item.cidade,
          item.endereco,
          item.campanha,
          ...Object.values(item.extras ?? {}),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aOk = leadMetaConfirmado(a);
        const bOk = leadMetaConfirmado(b);
        if (aOk !== bOk) return aOk ? 1 : -1;
        return 0;
      });
  }, [leads, query, filter]);

  function onUpload(formData: FormData) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await importMetaCsv(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Pronto: ${result.inseridos} novos, ${result.atualizados} já estavam e foram atualizados${
          result.ignorados ? `, ${result.ignorados} linhas sem nome` : ""
        }.`,
      );
      router.refresh();
    });
  }

  function onDelete(id: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteLeadMeta(id);
      setDeletingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onWhatsappOne(id: string) {
    setError("");
    setMessage("");
    setWhatsappingId(id);
    startTransition(async () => {
      const result = await whatsappLeadMetaFotos(id);
      setWhatsappingId(null);
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      setMessage(
        `WhatsApp enviado para ${result.to}. Espere ${result.esperaMinutos} min antes do próximo.`,
      );
      router.refresh();
    });
  }

  function onLiberarFila() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await whatsappLiberarFila();
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      setMessage("Fila liberada. Continua um envio por vez, com pausa e horário de conversa.");
      router.refresh();
    });
  }

  function onPausarFila() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await whatsappPausarFila();
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      setMessage("Fila pausada. Nada sai até você retomar.");
      router.refresh();
    });
  }

  function onRetomarFila() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await whatsappRetomarFila();
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      setMessage("Fila retomada. Envio automático ligado — pode fechar a página.");
      router.refresh();
    });
  }

  function onReconciliar() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await whatsappReconciliarNaoEnviados();
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      setMessage(
        `Z-API conferida: ${result.mantidos} realmente receberam. ${result.voltaram} voltaram para a fila.`,
      );
      router.refresh();
    });
  }

  function onWhatsappPendentes() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await whatsappLeadsMetaPendentes();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.enviados === 1) {
        setMessage(
          `Envio automático ligado. Mandou para ${result.nome ?? result.to}. Próximo em ${result.esperaMinutos} min. Pode fechar a página.`,
        );
      } else {
        setMessage(
          `Envio automático ligado. ${result.aviso ?? "Continua sozinho, mesmo com a página fechada."}`,
        );
      }
      router.refresh();
    });
  }

  if (sqlMissing) {
    return (
      <div className="rounded-[28px] bg-white p-8 text-ink">
        <h2 className="font-display text-2xl font-semibold">Falta configurar o banco</h2>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          Rode o arquivo{" "}
          <code className="rounded bg-cream px-1.5 py-0.5">supabase/leads-meta.sql</code> no{" "}
          <a
            className="font-semibold text-green underline"
            href="https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new"
            target="_blank"
            rel="noreferrer"
          >
            SQL Editor do Supabase
          </a>
          . Depois atualize esta página e envie o CSV.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          Formulário instantâneo
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Carregar CSV da Meta
        </h2>
        <form action={onUpload} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="csv"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-lime file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink hover:file:bg-lime-deep"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full bg-green px-5 py-2.5 text-sm font-bold text-white hover:bg-green-mid disabled:opacity-70"
          >
            {pending ? "Importando…" : "Importar leads"}
          </button>
        </form>
        {message ? (
          <p className="mt-4 rounded-2xl bg-lime/40 px-4 py-3 text-sm font-medium text-ink">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          WhatsApp · operação humana
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Pedir o book no WhatsApp
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          Só quem entrou pelo Instant Form. Um clique inicia a fila: um envio
          por vez, pausa de 4 a 9 min, “digitando…” de 8 a 14 s, horário de
          Brasília (seg–sex 9h30–22h, sáb 10h–16h, domingo fechado). Continua
          mesmo com a página fechada. A mensagem cita o anúncio e o descadastro
          por SAIR. Piloto de {estado.pilotoLimite} antes do restante.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-cream px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">
              Modo
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {estado.modo === "pausado"
                ? "Pausada"
                : estado.modo === "liberado"
                  ? "Liberada"
                  : `Piloto ${estado.pilotoEnviados}/${estado.pilotoLimite}`}
            </p>
          </div>
          <div className="rounded-2xl bg-cream px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">
              Na fila
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {counts.filaWhatsapp}
            </p>
          </div>
          <div className="rounded-2xl bg-cream px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">
              Entregue / lido
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {monitor.entregues} / {monitor.lidos}
            </p>
          </div>
          <div className="rounded-2xl bg-cream px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">
              Falhou / SAIR
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {monitor.falhou} / {monitor.saiu}
            </p>
          </div>
        </div>
        {estado.sqlMissing ? (
          <p className="mt-4 rounded-2xl bg-gold/30 px-4 py-3 text-sm leading-6 text-ink">
            Rode <code className="rounded bg-white px-1.5 py-0.5">supabase/whatsapp-fila.sql</code>{" "}
            no SQL Editor. Sem isso o piloto, o automático e o descadastro não
            gravam de verdade.
          </p>
        ) : null}
        {estado.autoEnvio && estado.modo !== "pausado" ? (
          <p className="mt-4 rounded-2xl bg-lime/40 px-4 py-3 text-sm font-medium text-ink">
            Envio automático ligado. Pode fechar a página — ao reabrir, o
            processo continua daqui.
            {soEspera
              ? ` Próximo em cerca de ${esperaMinutos} min.`
              : bloqueio
                ? ` ${bloqueio}`
                : " O próximo sai assim que o intervalo e o horário permitirem."}
          </p>
        ) : bloqueio ? (
          <p className="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm font-medium text-ink/70">
            {bloqueio}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {estado.autoEnvio && estado.modo !== "pausado" ? null : (
            <button
              type="button"
              disabled={
                pending ||
                !zapiReady ||
                counts.filaWhatsapp === 0 ||
                estado.modo === "pausado" ||
                (estado.modo === "piloto" &&
                  estado.pilotoEnviados >= estado.pilotoLimite)
              }
              onClick={onWhatsappPendentes}
              className="rounded-full bg-green px-5 py-2.5 text-sm font-bold text-white hover:bg-green-mid disabled:opacity-70"
            >
              {pending ? "Ligando…" : "Iniciar envio"}
            </button>
          )}
          {estado.modo !== "liberado" ? (
            <button
              type="button"
              disabled={pending || !podeLiberar}
              onClick={onLiberarFila}
              className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink hover:bg-lime-deep disabled:opacity-70"
            >
              Liberar restante
            </button>
          ) : null}
          {estado.modo === "pausado" ? (
            <button
              type="button"
              disabled={pending}
              onClick={onRetomarFila}
              className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink hover:bg-lime-deep disabled:opacity-70"
            >
              Retomar
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || !zapiReady}
              onClick={onPausarFila}
              className="rounded-full bg-cream px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-70"
            >
              Pausar
            </button>
          )}
          <button
            type="button"
            disabled={pending || !zapiReady}
            onClick={onReconciliar}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink ring-1 ring-black/10 hover:bg-cream disabled:opacity-70"
          >
            {pending ? "Conferindo…" : "Voltar não enviadas à fila"}
          </button>
        </div>
        {!podeLiberar && estado.modo === "piloto" ? (
          <p className="mt-3 text-sm text-ink/50">
            Liberar o restante só depois do piloto de {estado.pilotoLimite}, se
            falhas e SAIR ficarem abaixo de 3.
          </p>
        ) : null}
        {!zapiReady ? (
          <p className="mt-3 text-sm text-ink/50">
            Falta o <code className="rounded bg-cream px-1.5 py-0.5">ZAPI_CLIENT_TOKEN</code>{" "}
            (painel Z-API → Segurança), além de instância e token no ambiente.
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-2xl bg-lime/40 px-4 py-3 text-sm font-medium text-ink">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          Envios e respostas
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Quem já recebeu o WhatsApp
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          Nome, número, horário do envio, se entregou/leu e a última resposta
          da lead. A resposta aparece aqui quando ela responder no WhatsApp.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Na fila", value: counts.filaWhatsapp },
            { label: "Enviados", value: counts.enviado },
            { label: "Entregues", value: counts.entregue },
            { label: "Lidos", value: counts.lido },
            { label: "Responderam", value: counts.respondeu },
            { label: "SAIR", value: counts.saiu },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-cream px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">
                {stat.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        {envios.length === 0 ? (
          <p className="mt-5 text-sm text-ink/50">
            Nenhum WhatsApp desta operação ainda. O lote antigo só entra aqui
            se foi marcado com o prefixo do Z-API.
          </p>
        ) : (
          <div className="mt-5 divide-y divide-black/6 overflow-hidden rounded-2xl border border-black/6">
            {envios.map((item) => {
              const badge = whatsappBadge(item);
              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-2 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold leading-snug">
                        {item.nome_completo}
                      </h3>
                      {badge ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink/55">
                      {item.telefone ? (
                        <a
                          href={whatsappUrl(item.telefone)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-green hover:underline"
                        >
                          {item.telefone}
                        </a>
                      ) : (
                        "Sem número"
                      )}
                      {item.email_fotos_em
                        ? ` · enviado ${formatDateTime(item.email_fotos_em)}`
                        : ""}
                      {item.email_entregue_em
                        ? ` · entregue ${formatDateTime(item.email_entregue_em)}`
                        : ""}
                      {item.email_lido_em
                        ? ` · lido ${formatDateTime(item.email_lido_em)}`
                        : ""}
                    </p>
                    {item.whatsapp_ultima_resposta ? (
                      <p className="mt-2 rounded-xl bg-lime/30 px-3 py-2 text-sm leading-6 text-ink">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
                          Resposta
                          {item.whatsapp_ultima_resposta_em
                            ? ` · ${formatDateTime(item.whatsapp_ultima_resposta_em)}`
                            : ""}
                        </span>
                        <span className="mt-0.5 block whitespace-pre-wrap">
                          {item.whatsapp_ultima_resposta}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-ink/40">
                        Ainda sem resposta.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Todos", value: counts.todas },
          { label: "Pendentes", value: counts.pendente },
          { label: "Confirmados", value: counts.confirmado },
          { label: "Não chegou", value: counts.bounce },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-4 py-4 text-ink shadow-[0_8px_30px_rgba(4,23,15,0.06)]"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "pendente", label: "Pendentes" },
              { id: "confirmado", label: "Confirmados" },
              { id: "enviado", label: "Enviados" },
              { id: "lido", label: "Lidos" },
              { id: "respondeu", label: "Responderam" },
              { id: "bounce", label: "Não chegou" },
              { id: "saiu", label: "SAIR" },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-lime text-ink"
                    : "bg-white text-ink/60 hover:bg-white/80"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nome, telefone, e-mail, cidade…"
          className="w-full rounded-full border border-black/8 bg-white px-5 py-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-lime lg:max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] bg-white px-6 py-16 text-center text-ink">
          <p className="font-display text-2xl font-semibold">Nenhum lead da Meta.</p>
          <p className="mt-2 text-sm text-ink/50">
            {leads.length === 0
              ? "Envie o CSV do formulário instantâneo para aparecerem aqui."
              : "Tente outro termo ou filtro."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((item) => {
            const answers = extraEntries(item.extras);
            const confirmado = leadMetaConfirmado(item);
            const badge = whatsappBadge(item);
            return (
              <article
                key={item.id}
                className="rounded-[24px] bg-white p-5 text-ink shadow-[0_12px_40px_rgba(4,23,15,0.08)] sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                          confirmado
                            ? "bg-green text-white"
                            : "bg-gold/90 text-ink"
                        }`}
                      >
                        {confirmado ? "Confirmado" : "Pendente"}
                      </span>
                      {badge ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-semibold leading-snug">
                      {item.nome_completo}
                    </h3>
                    <p className="mt-1 text-sm text-ink/50">
                      {formatDateTime(item.created_at)}
                      {item.plataforma ? ` · ${item.plataforma}` : ""}
                    </p>
                    {item.email_fotos_em ? (
                      <p className="mt-1 text-xs leading-5 text-ink/45">
                        Enviado {formatDateTime(item.email_fotos_em)}
                        {item.email_entregue_em
                          ? ` · entregue ${formatDateTime(item.email_entregue_em)}`
                          : ""}
                        {item.email_lido_em
                          ? ` · lido ${formatDateTime(item.email_lido_em)}`
                          : ""}
                      </p>
                    ) : null}
                    {item.whatsapp_ultima_resposta ? (
                      <p className="mt-2 rounded-xl bg-lime/30 px-3 py-2 text-sm leading-6 text-ink">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
                          Resposta
                          {item.whatsapp_ultima_resposta_em
                            ? ` · ${formatDateTime(item.whatsapp_ultima_resposta_em)}`
                            : ""}
                        </span>
                        <span className="mt-0.5 block whitespace-pre-wrap">
                          {item.whatsapp_ultima_resposta}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.inscricao_id ? (
                      <>
                        <Link
                          href={`/admin/${item.inscricao_id}`}
                          className="rounded-full bg-green px-3 py-1.5 text-xs font-bold text-white hover:bg-green-mid"
                        >
                          Avaliar
                        </Link>
                        <CopyLink path={`/acompanhar/${item.inscricao_id}`} compact />
                      </>
                    ) : null}
                    {!confirmado &&
                    leadTemWhatsapp(item) &&
                    !leadWhatsappEnviado(item) &&
                    !leadWhatsappSaiu(item) ? (
                      <button
                        type="button"
                        disabled={pending || !zapiReady || Boolean(bloqueio)}
                        onClick={() => onWhatsappOne(item.id)}
                        className="rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink hover:bg-lime-deep disabled:opacity-70"
                      >
                        {whatsappingId === item.id ? "Enviando…" : "WhatsApp"}
                      </button>
                    ) : null}
                    {deletingId === item.id ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(item.id)}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-70"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                      Whatsapp
                    </dt>
                    <dd className="mt-1">
                      {item.telefone ? (
                        <a
                          href={whatsappUrl(
                            item.telefone,
                            confirmado
                              ? undefined
                              : leadFotosWhatsappMessage(item.nome_completo, item.id),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-green hover:underline"
                        >
                          {item.telefone}
                        </a>
                      ) : (
                        <span className="text-ink/35">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                      E-mail
                    </dt>
                    <dd className="mt-1 break-all">
                      {item.email ? (
                        <a
                          href={`mailto:${item.email}`}
                          className="text-ink/80 hover:underline"
                        >
                          {item.email}
                        </a>
                      ) : (
                        <span className="text-ink/35">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                      Instagram
                    </dt>
                    <dd className="mt-1">
                      {item.instagram ? (
                        <a
                          href={instagramUrl(item.instagram)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-green hover:underline"
                        >
                          {item.instagram}
                        </a>
                      ) : (
                        <span className="text-ink/35">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                      Endereço
                    </dt>
                    <dd className="mt-1 text-ink/80">
                      {[item.endereco, item.cidade].filter(Boolean).join(" · ") ||
                        "—"}
                    </dd>
                  </div>
                  {answers.map(([key, value]) => (
                    <div key={key} className="sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                        {extraLabel(key)}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-ink/80">
                        {value}
                      </dd>
                    </div>
                  ))}
                  {item.campanha ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                        Campanha
                      </dt>
                      <dd className="mt-1 text-ink/55">
                        {item.campanha}
                        {item.anuncio ? ` · ${item.anuncio}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-5">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
                    Fotos
                  </p>
                  {(item.fotos ?? []).length > 0 ? (
                    <PhotoGallery fotos={item.fotos} nome={item.nome_completo} />
                  ) : (
                    <p className="text-sm text-ink/40">Ainda sem fotos.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
