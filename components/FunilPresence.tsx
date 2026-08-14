"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { FunilEtapa } from "@/lib/funil";

const SESSION_KEY = "agnes_funil_sid";
const SKIP =
  /^\/(admin|analisedefunil)(\/|$)/;

type FunilSnapshot = {
  etapa: FunilEtapa;
  campos: string[];
  fotos: number;
};

const snapshot: FunilSnapshot = {
  etapa: "visitou",
  campos: [],
  fotos: 0,
};

function sessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const RANK: Record<FunilEtapa, number> = {
  visitou: 1,
  formulario: 2,
  preenchendo: 3,
  fotos: 4,
  enviando: 5,
  inscrita: 6,
};

export function reportFunil(next: Partial<FunilSnapshot>) {
  if (next.etapa && RANK[next.etapa] >= RANK[snapshot.etapa]) {
    snapshot.etapa = next.etapa;
  }
  if (next.campos) snapshot.campos = next.campos;
  if (typeof next.fotos === "number") snapshot.fotos = next.fotos;
  window.dispatchEvent(new Event("agnes-funil"));
}

async function ping(pagina: string) {
  const body = JSON.stringify({
    sessionId: sessionId(),
    pagina,
    etapa: snapshot.etapa,
    campos: snapshot.campos,
    fotos: snapshot.fotos,
  });
  try {
    await fetch("/api/funil/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body,
    });
  } catch {
    try {
      navigator.sendBeacon(
        "/api/funil/ping",
        new Blob([body], { type: "application/json" }),
      );
    } catch {
      /* ignore */
    }
  }
}

export function FunilPresence() {
  const pathname = usePathname();
  const pagina = pathname || "/";
  const skip = SKIP.test(pagina);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (skip) return;

    const send = () => {
      if (document.visibilityState === "hidden") return;
      void ping(pagina);
    };

    send();
    timer.current = window.setInterval(send, 12000);

    const onFunil = () => send();
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };

    window.addEventListener("agnes-funil", onFunil);
    document.addEventListener("visibilitychange", onVisible);

    const form = document.getElementById("inscricao");
    let observer: IntersectionObserver | undefined;
    if (form) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            reportFunil({ etapa: "formulario" });
          }
        },
        { threshold: 0.25 },
      );
      observer.observe(form);
    }

    return () => {
      window.clearInterval(timer.current);
      window.removeEventListener("agnes-funil", onFunil);
      document.removeEventListener("visibilitychange", onVisible);
      observer?.disconnect();
    };
  }, [pagina, skip]);

  return null;
}
