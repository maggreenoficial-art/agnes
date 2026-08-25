"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLeadMeta, importMetaCsv } from "@/app/admin/actions";
import { formatDateTime, instagramUrl, whatsappUrl } from "@/lib/inscricao";
import { leadMetaConfirmado } from "@/lib/lead-meta-status";
import type { LeadMeta } from "@/lib/leads-meta";
import { PhotoGallery } from "@/components/admin/PhotoGallery";

type StatusFiltro = "todas" | "pendente" | "confirmado";

function pedidoFotosWhatsapp(nome: string) {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  return `Oi, ${primeiro}! Para completar sua inscrição no casting Agnes Pimentel + Mix Models, envie 5 fotos aqui: https://www.agnespimentel.com/fotos`;
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
}: {
  leads: LeadMeta[];
  sqlMissing?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFiltro>("pendente");

  const counts = useMemo(() => {
    const confirmado = leads.filter(leadMetaConfirmado).length;
    return {
      todas: leads.length,
      confirmado,
      pendente: leads.length - confirmado,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .filter((item) => {
        const confirmado = leadMetaConfirmado(item);
        if (filter === "pendente" && confirmado) return false;
        if (filter === "confirmado" && !confirmado) return false;
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

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Todos", value: counts.todas },
          { label: "Pendentes", value: counts.pendente },
          { label: "Confirmados", value: counts.confirmado },
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
            return (
              <article
                key={item.id}
                className="rounded-[24px] bg-white p-5 text-ink shadow-[0_12px_40px_rgba(4,23,15,0.08)] sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        confirmado
                          ? "bg-green text-white"
                          : "bg-gold/90 text-ink"
                      }`}
                    >
                      {confirmado ? "Confirmado" : "Pendente"}
                    </span>
                    <h3 className="mt-2 font-display text-xl font-semibold leading-snug">
                      {item.nome_completo}
                    </h3>
                    <p className="mt-1 text-sm text-ink/50">
                      {formatDateTime(item.created_at)}
                      {item.plataforma ? ` · ${item.plataforma}` : ""}
                    </p>
                  </div>
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
                              : pedidoFotosWhatsapp(item.nome_completo),
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
