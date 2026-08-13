import Link from "next/link";
import { InstitutoSeal, MixWordmark, WindowDots } from "@/components/Brand";

export default function ObrigadaPage() {
  return (
    <main className="flex min-h-svh flex-col bg-green-deep px-5 py-10 sm:px-8">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between">
        <MixWordmark className="text-xl text-white" />
        <InstitutoSeal className="size-14" priority />
      </header>

      <section className="relative mx-auto mt-16 w-full max-w-xl pt-4">
        <div className="absolute top-1 right-5 z-20 rotate-3 rounded-sm bg-lime px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink shadow-sm sm:right-8">
          Inscrição enviada
        </div>
        <div className="overflow-hidden rounded-[28px] bg-white text-ink">
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-3">
            <WindowDots />
            <InstitutoSeal className="size-8" />
          </div>
          <div className="px-6 py-10 sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green">
              Obrigada
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-snug">
              Seu primeiro passo foi dado.
            </h1>
            <p className="mt-4 text-base leading-7 text-ink/65">
              Recebemos o seu perfil. Nossa equipe vai avaliar as informações e
              as fotos. Se você for aprovada, seguirá para a etapa presencial na
              quadra da Imperatriz Leopoldinense.
            </p>
            <div className="mt-8 space-y-2 font-display text-xl font-semibold">
              <p>Não precisa ter experiência.</p>
              <p>Não precisa ter portfólio.</p>
              <p className="text-green">Precisa querer.</p>
            </div>
            <Link
              href="/"
              className="mt-10 inline-flex rounded-full bg-lime px-6 py-3 font-semibold text-ink hover:bg-lime-deep"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
