"use client";

import { useState } from "react";
import { FotosForm } from "@/components/FotosForm";
import { InscricaoForm } from "@/components/InscricaoForm";

export function InscricaoTabs() {
  const [aba, setAba] = useState<"completa" | "fotos">("completa");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAba("completa")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            aba === "completa"
              ? "bg-lime text-ink"
              : "bg-white/10 text-white/75 hover:bg-white/15"
          }`}
        >
          Inscrição completa
        </button>
        <button
          type="button"
          onClick={() => setAba("fotos")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            aba === "fotos"
              ? "bg-lime text-ink"
              : "bg-white/10 text-white/75 hover:bg-white/15"
          }`}
        >
          Já preenchi no Instagram
        </button>
      </div>
      {aba === "completa" ? <InscricaoForm /> : <FotosForm />}
    </div>
  );
}
