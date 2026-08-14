import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAdmin } from "@/app/admin/actions";
import { OfficialMarks } from "@/components/Brand";
import { FunilDashboard } from "@/components/funil/FunilDashboard";
import { isAdmin } from "@/lib/admin-auth";

export default async function AnaliseDeFunilPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login?next=/analisedefunil");
  }

  return (
    <main className="min-h-svh bg-[#f3efe4] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[28px] bg-green-deep px-5 py-6 sm:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <OfficialMarks
                className="shrink-0"
                sealClassName="size-10 sm:size-14"
                mixClassName="h-5 w-auto max-w-[140px] sm:h-7 sm:max-w-none"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-lime">
                  Análise ao vivo
                </p>
                <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                  Funil de inscrição
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-deep"
              >
                Perfis
              </Link>
              <form action={logoutAdmin}>
                <button
                  type="submit"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Sair
                </button>
              </form>
            </div>
          </header>
        </div>
        <FunilDashboard />
      </div>
    </main>
  );
}
