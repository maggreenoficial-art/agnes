import Image from "next/image";
import { InstitutoSeal, LogoMixModels, OfficialMarks } from "@/components/Brand";
import { InscricaoTabs } from "@/components/InscricaoTabs";
import {
  ENDERECO,
  MAPS_DIRECTIONS,
  MAPS_EMBED,
  MAPS_LINK,
} from "@/lib/venue";

const INSTAGRAMS = [
  {
    name: "Agnes Pimentel",
    handle: "@agnesspimentel",
    href: "https://www.instagram.com/agnesspimentel/",
  },
  {
    name: "Instituto Imperatriz",
    handle: "@institutoimperatriz",
    href: "https://www.instagram.com/institutoimperatriz/",
  },
  {
    name: "Imperatriz Leopoldinense",
    handle: "@imperatrizleopoldinenseoficial",
    href: "https://www.instagram.com/imperatrizleopoldinenseoficial/",
  },
  {
    name: "Mix Models",
    handle: "@mixmodelsagency",
    href: "https://www.instagram.com/mixmodelsagency/",
  },
  {
    name: "Voz das Comunidades",
    handle: "@vozdascomunidades",
    href: "https://www.instagram.com/vozdascomunidades/",
  },
];

export default function Home() {
  return (
    <div className="min-h-full">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <LogoMixModels className="h-5 w-auto sm:h-6" priority />
        <p className="pointer-events-none absolute inset-x-0 hidden text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80 lg:block">
          Agnes Pimentel · Instituto Imperatriz · Mix Models
        </p>
        <InstitutoSeal className="size-11 sm:size-12" priority />
      </header>

      <section className="relative min-h-[100svh] overflow-hidden">
        <Image
          src="/img-header.jpg"
          alt="Agnes Pimentel em fantasia da Imperatriz Leopoldinense"
          fill
          priority
          className="object-cover object-[center_12%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-deep/35 via-green-deep/50 to-green-deep" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20">
          <div className="rise max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-sm bg-lime px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
              Seleção Instituto Imperatriz
              <span className="grid size-5 place-items-center rounded-full bg-white/90 text-[11px] text-ink">
                →
              </span>
            </p>
            <h1 className="font-display text-4xl font-semibold leading-snug tracking-tight text-white sm:text-6xl sm:leading-[1.12]">
              Agnes Pimentel abre seleção para novos talentos da Zona da
              Leopoldina.
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/75 italic sm:text-lg">
              Com apoio do Instituto Imperatriz e da Mix Models
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#inscricao"
                className="rounded-full bg-lime px-7 py-3.5 text-base font-semibold text-ink transition hover:bg-lime-deep"
              >
                Quero me inscrever
              </a>
              <div className="rounded-2xl bg-white px-4 py-2 text-ink shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
                  Inscrições até
                </p>
                <p className="font-display text-2xl font-semibold leading-none">
                  07 <span className="text-green">Set</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="inscricao"
        className="relative overflow-hidden bg-[#072015] px-5 py-16 sm:px-8 sm:py-24"
      >
        <Image
          src="/img-base.png"
          alt=""
          fill
          className="object-cover object-[center_20%] opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-deep via-green-deep/85 to-green-deep" />
        <div className="relative mx-auto max-w-3xl">
          <InscricaoTabs />
        </div>
      </section>

      <section className="bg-cream px-5 py-14 text-ink sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            "Não precisa ter experiência.",
            "Não precisa ter portfólio.",
            "Precisa querer.",
          ].map((line, index) => (
            <article
              key={line}
              className="rounded-[28px] bg-white p-7 shadow-[0_10px_40px_rgba(4,23,15,0.06)]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/30">
                  0{index + 1}
                </span>
              </div>
              <p className="font-display text-2xl font-semibold leading-snug">
                {line}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-green-deep px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-lime">
              Processo seletivo
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-snug text-white sm:text-5xl">
              Quer dar o primeiro passo na carreira de modelo?
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-cream/75">
              Idealizado pela modelo e musa Agnes Pimentel, este processo traz a
              oportunidade de você realizar o seu sonho. Inscreva-se para a
              seleção presencial da Mix Models Agency, na quadra da Imperatriz
              Leopoldinense.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-cream/75">
              A primeira etapa é online. A avaliação do seu perfil será feita
              pela nossa equipe e, se for aprovada, você segue para a etapa
              presencial.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[32px]">
              <Image
                src="/quadra.jpg"
                alt="Quadra da Imperatriz Leopoldinense"
                width={1600}
                height={1066}
                className="h-full min-h-[280px] w-full object-cover lg:min-h-[380px]"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-green/90 p-5 text-white backdrop-blur-sm">
                <p className="font-display text-lg font-bold">
                  Acontecerá na Quadra da Imperatriz Leopoldinense
                </p>
                <a
                  href={MAPS_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-sm text-white/90 underline-offset-2 hover:underline"
                >
                  {ENDERECO}
                </a>
                <a
                  href={MAPS_DIRECTIONS}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-deep"
                >
                  Como chegar no Maps
                </a>
              </div>
            </div>
            <div className="overflow-hidden rounded-[32px] border border-white/10">
              <iframe
                title="Mapa da Quadra da Imperatriz Leopoldinense"
                src={MAPS_EMBED}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[240px] w-full lg:h-[280px]"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-green-deep px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex items-center">
            <OfficialMarks
              sealClassName="size-14"
              mixClassName="h-7 w-auto"
            />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-lime">
              Siga no Instagram
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {INSTAGRAMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-cream transition hover:border-lime hover:bg-lime hover:text-ink"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-xs opacity-70">{item.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
