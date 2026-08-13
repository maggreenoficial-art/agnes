"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/address";

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-cream px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink/35 focus:border-green focus:ring-2 focus:ring-lime/70";

export function AddressField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 5) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/endereco?q=${encodeURIComponent(query)}`);
        const data = (await response.json()) as {
          suggestions?: AddressSuggestion[];
        };
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [value]);

  function choose(suggestion: AddressSuggestion) {
    skipRef.current = true;
    onChange(suggestion.label);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative sm:col-span-2">
      <label className="block space-y-2">
        <span className="block text-sm font-medium text-ink/80">
          Endereço atual
          <span className="ml-1 text-green">*</span>
        </span>
        <input
          className={inputClass}
          autoComplete="off"
          placeholder="Rua e número, ex.: Rua Professor Lacê, 235"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
        />
        {!error ? (
          <span className="block text-xs text-ink/45">
            {loading
              ? "Buscando endereço…"
              : "Digite a rua e o número. Bairro, cidade e CEP entram sozinhos."}
          </span>
        ) : (
          <span className="block text-xs text-red-600">{error}</span>
        )}
      </label>

      {open && suggestions.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-black/10 bg-white py-2 shadow-[0_16px_40px_rgba(4,23,15,0.12)]">
          {suggestions.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-cream"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
