import Image from "next/image";
import Link from "next/link";
import { InstitutoSeal, LogoMixModels } from "@/components/Brand";
import { FotosForm } from "@/components/FotosForm";

export const metadata = {
  title: "Enviar fotos | Agnes Pimentel + Mix Models",
  description:
    "Quem já preencheu o formulário no Instagram envia aqui só o nome, o WhatsApp e as 5 fotos do casting.",
};

export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string }>;
}) {
  const { nome } = await searchParams;

  return (
    <div className="min-h-full">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <LogoMixModels className="h-5 w-auto sm:h-6" priority />
        <InstitutoSeal className="size-11 sm:size-12" priority />
      </header>

      <section className="relative min-h-[100svh] overflow-hidden bg-[#072015] px-5 pb-16 pt-28 sm:px-8 sm:pb-24">
        <Image
          src="/img-base.png"
          alt=""
          fill
          className="object-cover object-[center_20%] opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-deep via-green-deep/85 to-green-deep" />
        <div className="relative mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-lime">
            Processo seletivo
          </p>
          <FotosForm nomeInicial={nome?.trim() ?? ""} />
          <p className="mt-6 text-center text-sm text-white/55">
            Ainda não se inscreveu?{" "}
            <Link href="/#inscricao" className="font-semibold text-lime hover:underline">
              Preencha a inscrição completa
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
