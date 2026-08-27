"use client";

import { logoutAdmin } from "@/app/admin/actions";
import { OfficialMarks } from "@/components/Brand";

export function AdminHeader({
  total,
  title = "Perfis recebidos",
  showExcel = true,
  engajadosCount,
}: {
  total: number;
  title?: string;
  showExcel?: boolean;
  engajadosCount?: number;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <OfficialMarks
          className="shrink-0"
          sealClassName="size-10 sm:size-14"
          mixClassName="h-5 w-auto max-w-[140px] sm:h-7 sm:max-w-none"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-lime">
            Processo seletivo
          </p>
          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            {title}
            <span className="ml-2 text-lime">{total}</span>
          </h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {typeof engajadosCount === "number" ? (
          <>
            {/* File download, not a client navigation */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/admin/export/engajados"
              className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-deep"
            >
              CSV Meta · {engajadosCount} engajados
            </a>
          </>
        ) : null}
        {showExcel ? (
          <>
            {/* File download, not a client navigation */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/admin/export/excel"
              className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-deep"
            >
              Excel da lista
            </a>
          </>
        ) : null}
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
  );
}
