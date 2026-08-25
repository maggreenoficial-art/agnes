"use client";

import { useState } from "react";

export function CopyLink({
  path,
  compact = false,
}: {
  path: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copie o link:", url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        compact
          ? "rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink hover:bg-lime-deep"
          : "rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink hover:bg-lime-deep"
      }
    >
      {copied ? "Link copiado" : "Copiar link"}
    </button>
  );
}
