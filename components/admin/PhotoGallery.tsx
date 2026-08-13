"use client";

import { useEffect, useState } from "react";

export function PhotoGallery({
  fotos,
  nome,
}: {
  fotos: string[];
  nome: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (fotos.length === 0) {
    return (
      <p className="rounded-2xl bg-cream px-4 py-8 text-center text-sm text-ink/45">
        Nenhuma foto enviada.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {fotos.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-cream"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${nome} — foto ${index + 1}`}
              className="size-full object-cover transition duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {active !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[active]}
            alt={`${nome} — foto ${active + 1}`}
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
