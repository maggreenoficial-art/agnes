"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStatus } from "@/app/admin/actions";
import {
  STATUS_LABEL,
  STATUS_OPTIONS,
  type InscricaoStatus,
} from "@/lib/inscricao";

export function StatusActions({
  id,
  status,
}: {
  id: string;
  status: InscricaoStatus;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onChange(next: InscricaoStatus) {
    const previous = current;
    setCurrent(next);
    setError("");
    startTransition(async () => {
      const result = await updateStatus(id, next);
      if (result?.error) {
        setCurrent(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
        Avaliação
      </p>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => {
          const active = current === option;
          return (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => onChange(option)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                active
                  ? option === "aprovada"
                    ? "bg-green text-white"
                    : option === "reprovada"
                      ? "bg-ink text-white"
                      : "bg-lime text-ink"
                  : "bg-cream text-ink/55 hover:bg-cream/80"
              }`}
            >
              {STATUS_LABEL[option]}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
