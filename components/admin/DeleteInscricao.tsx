"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInscricao } from "@/app/admin/actions";

export function DeleteInscricao({
  id,
  nome,
  compact = false,
}: {
  id: string;
  nome: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setError("");
    startTransition(async () => {
      const result = await deleteInscricao(id, compact);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      if (compact) {
        router.refresh();
      }
    });
  }

  if (compact) {
    return (
      <div>
        {confirming ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-70"
          >
            {pending ? "Excluindo…" : "Confirmar exclusão"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            Excluir
          </button>
        )}
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-black/6 pt-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
        Cadastro
      </p>
      {confirming ? (
        <div className="rounded-2xl bg-red-50 px-4 py-4">
          <p className="text-sm text-red-800">
            Excluir o cadastro de <strong>{nome}</strong>? Essa ação não pode ser
            desfeita.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-70"
            >
              {pending ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-cream"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
        >
          Excluir cadastro
        </button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
