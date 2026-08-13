"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateStatus } from "@/app/admin/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  STATUS_LABEL,
  STATUS_OPTIONS,
  idade,
  instagramUrl,
  type Inscricao,
  type InscricaoStatus,
} from "@/lib/inscricao";

const FILTERS: Array<{ id: "todas" | InscricaoStatus; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "nova", label: "Novas" },
  { id: "em_analise", label: "Em análise" },
  { id: "aprovada", label: "Aprovadas" },
  { id: "reprovada", label: "Reprovadas" },
];

export function AdminBoard({ inscricoes }: { inscricoes: Inscricao[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todas" | InscricaoStatus>("todas");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inscricoes.filter((item) => {
      if (filter !== "todas" && item.status !== filter) return false;
      if (!needle) return true;
      return (
        item.nome_completo.toLowerCase().includes(needle) ||
        item.email.toLowerCase().includes(needle) ||
        item.instagram.toLowerCase().includes(needle) ||
        item.telefone.includes(needle)
      );
    });
  }, [inscricoes, query, filter]);

  const counts = useMemo(
    () => ({
      total: inscricoes.length,
      nova: inscricoes.filter((item) => item.status === "nova").length,
      em_analise: inscricoes.filter((item) => item.status === "em_analise")
        .length,
      aprovada: inscricoes.filter((item) => item.status === "aprovada").length,
      reprovada: inscricoes.filter((item) => item.status === "reprovada")
        .length,
    }),
    [inscricoes],
  );

  function changeStatus(id: string, status: InscricaoStatus) {
    setPendingId(id);
    startTransition(async () => {
      await updateStatus(id, status);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Recebidas", value: counts.total },
          { label: "Novas", value: counts.nova },
          { label: "Em análise", value: counts.em_analise },
          { label: "Aprovadas", value: counts.aprovada },
          { label: "Reprovadas", value: counts.reprovada },
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
          {FILTERS.map((item) => {
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
          placeholder="Buscar nome, Instagram, e-mail…"
          className="w-full rounded-full border border-black/8 bg-white px-5 py-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-lime lg:max-w-sm"
        />
      </div>

      {filtered.length > 0 && (filter !== "todas" || query.trim()) ? (
        <a
          href={`/admin/export/excel?ids=${filtered.map((item) => item.id).join(",")}`}
          className="inline-flex text-sm font-semibold text-green hover:underline"
        >
          Exportar {filtered.length} perfil{filtered.length === 1 ? "" : "s"} filtrado{filtered.length === 1 ? "" : "s"} em Excel
        </a>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-[28px] bg-white px-6 py-16 text-center text-ink">
          <p className="font-display text-2xl font-semibold">
            Nenhum perfil por aqui.
          </p>
          <p className="mt-2 text-sm text-ink/50">
            {inscricoes.length === 0
              ? "Quando alguém se inscrever, o book aparece nesta página."
              : "Tente outro filtro ou termo de busca."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const years = idade(item.data_nascimento);
            const cover = item.fotos[0];
            const busy = isPending && pendingId === item.id;

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-[24px] bg-white text-ink shadow-[0_12px_40px_rgba(4,23,15,0.08)]"
              >
                <Link href={`/admin/${item.id}`} className="block">
                  <div className="relative aspect-[3/4] bg-cream">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={item.nome_completo}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-sm text-ink/30">
                        Sem foto
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </Link>
                <div className="space-y-3 p-4">
                  <div>
                    <Link
                      href={`/admin/${item.id}`}
                      className="font-display text-xl font-semibold leading-snug hover:text-green"
                    >
                      {item.nome_completo}
                    </Link>
                    <p className="mt-1 text-sm text-ink/55">
                      {years !== null ? `${years} anos` : "Idade —"} ·{" "}
                      {item.altura}
                    </p>
                  </div>
                  <a
                    href={instagramUrl(item.instagram)}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-semibold text-green hover:underline"
                  >
                    {item.instagram}
                  </a>
                  <div className="flex gap-2">
                    <a
                      href={`/admin/${item.id}/export/pdf`}
                      className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink hover:bg-lime"
                    >
                      PDF
                    </a>
                    <a
                      href={`/admin/${item.id}/export/excel`}
                      className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink hover:bg-lime"
                    >
                      Excel
                    </a>
                  </div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-ink/35">
                    Status
                    <select
                      className="mt-1 w-full rounded-xl border border-black/10 bg-cream px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink outline-none"
                      value={item.status}
                      disabled={busy}
                      onChange={(event) =>
                        changeStatus(
                          item.id,
                          event.target.value as InscricaoStatus,
                        )
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
