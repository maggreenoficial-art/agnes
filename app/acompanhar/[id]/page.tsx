import { notFound } from "next/navigation";
import { InstitutoSeal, MixWordmark, WindowDots } from "@/components/Brand";
import { CopyLink } from "@/components/CopyLink";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAcompanhamento } from "@/lib/acompanhar";
import {
  STATUS_PUBLIC_LABEL,
  STATUS_PUBLIC_TEXT,
  type InscricaoStatus,
} from "@/lib/inscricao";

export const dynamic = "force-dynamic";

const STEPS: InscricaoStatus[] = ["nova", "em_analise", "aprovada"];

export default async function AcompanharPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const { id } = await params;
  const { novo } = await searchParams;
  const perfil = await getAcompanhamento(id);

  if (!perfil) {
    notFound();
  }

  const firstName = perfil.nome_completo.split(/\s+/)[0];
  const isNew = novo === "1";
  const path = `/acompanhar/${perfil.id}`;

  return (
    <main className="flex min-h-svh flex-col bg-green-deep px-5 py-10 sm:px-8">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between">
        <MixWordmark className="text-xl text-white" />
        <InstitutoSeal className="size-14" priority />
      </header>

      <section className="relative mx-auto mt-16 w-full max-w-xl pt-4">
        <div className="absolute top-1 right-5 z-20 rotate-3 rounded-sm bg-lime px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink shadow-sm sm:right-8">
          {isNew ? "Inscrição enviada" : "Acompanhar"}
        </div>
        <div className="overflow-hidden rounded-[28px] bg-white text-ink">
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-3">
            <WindowDots />
            <InstitutoSeal className="size-8" />
          </div>
          <div className="px-6 py-10 sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green">
              {isNew ? "Obrigada" : "Processo seletivo"}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-snug sm:text-4xl">
              {isNew
                ? "Seu primeiro passo foi dado."
                : `Olá, ${firstName}.`}
            </h1>
            <p className="mt-4 text-base leading-7 text-ink/65">
              {isNew
                ? "Recebemos o seu perfil. Guarde este link para acompanhar se você foi para análise, aprovada ou não."
                : STATUS_PUBLIC_TEXT[perfil.status]}
            </p>

            <div className="mt-8 rounded-2xl bg-cream p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
                Situação atual
              </p>
              <div className="mt-3 flex items-center gap-3">
                <StatusBadge status={perfil.status} />
                <p className="font-display text-xl font-semibold">
                  {STATUS_PUBLIC_LABEL[perfil.status]}
                </p>
              </div>
              {!isNew ? null : (
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  {STATUS_PUBLIC_TEXT[perfil.status]}
                </p>
              )}
            </div>

            {perfil.status !== "reprovada" ? (
              <ol className="mt-8 grid grid-cols-3 gap-2 text-center">
                {STEPS.map((step) => {
                  const currentIndex = STEPS.indexOf(
                    perfil.status === "aprovada" ? "aprovada" : perfil.status,
                  );
                  const stepIndex = STEPS.indexOf(step);
                  const done = stepIndex <= currentIndex;
                  return (
                    <li
                      key={step}
                      className={`rounded-2xl px-2 py-3 text-[11px] font-bold uppercase tracking-wide ${
                        done ? "bg-green text-white" : "bg-cream text-ink/35"
                      }`}
                    >
                      {STATUS_PUBLIC_LABEL[step]}
                    </li>
                  );
                })}
              </ol>
            ) : null}

            <div className="mt-8 space-y-3">
              <p className="text-sm text-ink/55">
                Este link é só seu. Quem tiver ele consegue ver o status da
                inscrição.
              </p>
              <CopyLink path={path} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
