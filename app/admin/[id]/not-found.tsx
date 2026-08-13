import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#f3efe4] px-5 text-center">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-ink">
          Perfil não encontrado
        </h1>
        <Link
          href="/admin"
          className="mt-4 inline-flex rounded-full bg-lime px-5 py-2 font-bold text-ink"
        >
          Voltar aos perfis
        </Link>
      </div>
    </main>
  );
}
