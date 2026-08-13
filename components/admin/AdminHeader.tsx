"use client";

import { logoutAdmin } from "@/app/admin/actions";
import { MixWordmark, LogoImperatriz } from "@/components/Brand";

export function AdminHeader({ total }: { total: number }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <LogoImperatriz className="size-12 sm:size-14" />
        <MixWordmark className="text-xl text-white" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-lime">
            Processo seletivo
          </p>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
            Perfis recebidos
            <span className="ml-2 text-lime">{total}</span>
          </h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* File download, not a client navigation */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/export/excel"
          className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-deep"
        >
          Excel da lista
        </a>
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
