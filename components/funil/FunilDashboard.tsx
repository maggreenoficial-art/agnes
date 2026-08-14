"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CAMPO_LABEL,
  FUNIL_ETAPAS,
  FUNIL_LABEL,
  type FunilEstado,
  type FunilEtapa,
} from "@/lib/funil";
import { FunilMap } from "@/components/funil/FunilMap";

const EMPTY: FunilEstado = {
  online: 0,
  visitantes_hoje: 0,
  inscritas_hoje: 0,
  inscritas_total: 0,
  hoje: {
    visitou: 0,
    formulario: 0,
    preenchendo: 0,
    fotos: 0,
    enviando: 0,
    inscrita: 0,
  },
  sessoes: [],
};

function etapaTone(etapa: FunilEtapa) {
  if (etapa === "inscrita" || etapa === "enviando") return "bg-lime text-ink";
  if (etapa === "preenchendo" || etapa === "fotos") return "bg-green text-white";
  if (etapa === "formulario") return "bg-[#e2c56a] text-ink";
  return "bg-cream text-ink/70";
}

export function FunilDashboard() {
  const [estado, setEstado] = useState<FunilEstado>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/funil/estado", { cache: "no-store" });
      if (cancelled) return;
      if (response.status === 401) {
        window.location.assign("/admin/login?next=/analisedefunil");
        return;
      }
      if (response.status === 503) {
        setError("sql-missing");
        return;
      }
      if (!response.ok) {
        setError("load");
        return;
      }
      const data = (await response.json()) as FunilEstado;
      setError(null);
      setEstado(data);
      setTick(Date.now());
    }
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const maxFunil = Math.max(1, ...FUNIL_ETAPAS.map((etapa) => estado.hoje[etapa] ?? 0));
  const cidades = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sessao of estado.sessoes) {
      const nome = sessao.cidade || "Cidade não identificada";
      counts.set(nome, (counts.get(nome) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [estado.sessoes]);

  if (error === "sql-missing") {
    return (
      <div className="rounded-[28px] bg-white p-8 text-ink">
        <h2 className="font-display text-2xl font-semibold">Falta configurar o banco</h2>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          Rode o arquivo{" "}
          <code className="rounded bg-cream px-1.5 py-0.5">supabase/funil.sql</code> no{" "}
          <a
            className="font-semibold text-green underline"
            href="https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new"
            target="_blank"
            rel="noreferrer"
          >
            SQL Editor do Supabase
          </a>
          . Depois atualize esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Online agora", value: estado.online },
          { label: "Visitantes hoje", value: estado.visitantes_hoje },
          { label: "Inscritas hoje", value: estado.inscritas_hoje },
          { label: "Inscritas no total", value: estado.inscritas_total },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-4 py-4 text-ink shadow-[0_8px_30px_rgba(4,23,15,0.06)]"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
              Funil de hoje
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              Da visita até a inscrição
            </h2>
          </div>
          <p className="text-xs text-ink/40">
            Atualiza sozinho · {tick ? "ao vivo" : "carregando"}
          </p>
        </div>
        <ol className="mt-6 space-y-3">
          {FUNIL_ETAPAS.map((etapa) => {
            const value = estado.hoje[etapa] ?? 0;
            const width = `${Math.max(6, (value / maxFunil) * 100)}%`;
            return (
              <li key={etapa}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{FUNIL_LABEL[etapa]}</span>
                  <span className="text-ink/50">{value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full bg-green"
                    style={{ width }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          Mapa ao vivo
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Quem está no site agora
        </h2>
        <p className="mt-2 text-sm text-ink/55">
          Cidade pelo IP (não é rua). Vários na mesma cidade aparecem um pouco
          espalhados para não ficar um ponto só.
        </p>
        <div className="mt-5">
          <FunilMap sessoes={estado.sessoes} />
        </div>
        {cidades.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2">
            {cidades.map(([cidade, count]) => (
              <li
                key={cidade}
                className="rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-ink"
              >
                {cidade}
                <span className="ml-2 text-green">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-ink/45">Ninguém online neste momento.</p>
        )}
      </section>

      <section className="rounded-[28px] bg-white p-5 text-ink sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          Preenchimento
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          O que cada visitante está fazendo
        </h2>
        {estado.sessoes.length === 0 ? (
          <p className="mt-5 text-sm text-ink/45">
            Quando alguém abrir o site, a sessão aparece aqui.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-black/6">
            {estado.sessoes.map((sessao) => (
              <li key={sessao.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${etapaTone(sessao.etapa)}`}
                  >
                    {FUNIL_LABEL[sessao.etapa]}
                  </span>
                  <p className="text-sm font-semibold">
                    {sessao.cidade || "Cidade não identificada"}
                    {sessao.estado ? ` · ${sessao.estado}` : ""}
                  </p>
                </div>
                <p className="mt-2 text-sm text-ink/55">
                  {sessao.etapa === "visitou"
                    ? "Vendo a página, ainda não chegou no formulário."
                    : sessao.campos.length === 0 && sessao.fotos === 0
                      ? "Está no formulário, ainda sem preencher."
                      : [
                          ...sessao.campos.map(
                            (campo) => CAMPO_LABEL[campo] ?? campo,
                          ),
                          sessao.fotos > 0 ? `${sessao.fotos} foto${sessao.fotos === 1 ? "" : "s"}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
