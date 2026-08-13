"use client";

import { useState } from "react";
import { loginAdmin } from "@/app/admin/actions";
import { LogoImperatriz, WindowDots } from "@/components/Brand";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await loginAdmin(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form
      action={onSubmit}
      className="relative overflow-hidden rounded-[28px] bg-white text-ink"
    >
      <div className="absolute -top-3 right-6 rotate-3 rounded-sm bg-lime px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide">
        Equipe
      </div>
      <div className="flex items-center justify-between border-b border-black/6 px-6 py-3">
        <WindowDots />
        <LogoImperatriz className="size-8" />
      </div>
      <div className="space-y-5 px-6 py-10 sm:px-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-green">
            Área interna
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            Perfis recebidos
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Entre para avaliar as inscrições da seleção Mix Models × Instituto
            Imperatriz.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink/80">Senha</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-2xl border border-black/10 bg-cream px-4 py-3.5 text-[15px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-lime/70"
          />
        </label>
        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-lime py-4 font-display text-lg font-extrabold text-ink hover:bg-lime-deep disabled:opacity-70"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
