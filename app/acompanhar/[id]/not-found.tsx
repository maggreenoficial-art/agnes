import Link from "next/link";

export default function AcompanharNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-green-deep px-5 text-center text-cream">
      <div>
        <h1 className="font-display text-3xl font-semibold">
          Link não encontrado
        </h1>
        <p className="mt-3 text-sm text-cream/70">
          Esse acompanhamento não existe ou o endereço está incompleto.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-lime px-5 py-2 font-bold text-ink"
        >
          Ir para a inscrição
        </Link>
      </div>
    </main>
  );
}
