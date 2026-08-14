"use client";

import { useEffect, useRef, useState } from "react";
import type { FunilEtapa, FunilSessao } from "@/lib/funil";
import { FUNIL_LABEL } from "@/lib/funil";

interface LeafletLayer {
  remove: () => void;
  options?: unknown;
  bindPopup: (html: string) => LeafletLayer;
  addTo: (map: LeafletMap) => LeafletLayer;
}

interface LeafletMap {
  remove: () => void;
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  invalidateSize: () => void;
  eachLayer: (fn: (layer: LeafletLayer) => void) => void;
  addLayer: (layer: unknown) => void;
}

interface LeafletModule {
  map: (el: HTMLElement, opts?: { scrollWheelZoom?: boolean }) => LeafletMap;
  tileLayer: (url: string, opts: Record<string, unknown>) => LeafletLayer;
  circleMarker: (
    latlng: [number, number],
    opts: Record<string, unknown>,
  ) => LeafletLayer;
}

declare global {
  interface Window {
    L?: LeafletModule;
  }
}

const COLORS: Record<FunilEtapa, string> = {
  visitou: "#f6f3ea",
  formulario: "#e2c56a",
  preenchendo: "#c8eb4b",
  fotos: "#0c7a3e",
  enviando: "#ffffff",
  inscrita: "#b4d63a",
};

const RAMOS: [number, number] = [-22.851, -43.255];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jitter(id: string, lat: number, lng: number): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const dLat = ((hash % 1000) / 1000 - 0.5) * 0.04;
  const dLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.04;
  return [lat + dLat, lng + dLng];
}

function loadLeaflet() {
  return new Promise<LeafletModule>((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.L) resolve(window.L);
        else reject(new Error("leaflet"));
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("leaflet"));
    };
    script.onerror = () => reject(new Error("leaflet"));
    document.body.appendChild(script);
  });
}

export function FunilMap({ sessoes }: { sessoes: FunilSessao[] }) {
  const root = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<LeafletModule["map"]> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || !root.current || mapRef.current) return;
      const map = L.map(root.current, { scrollWheelZoom: false });
      map.setView(RAMOS, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 16,
      }).addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 250);
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!ready || !map || !L) return;

    map.eachLayer((layer) => {
      if ("options" in layer && layer.options && "radius" in (layer.options as object)) {
        layer.remove();
      }
    });

    sessoes.forEach((sessao) => {
      const baseLat = sessao.lat ?? RAMOS[0];
      const baseLng = sessao.lng ?? RAMOS[1];
      const [lat, lng] = jitter(sessao.id, baseLat, baseLng);
      const cidade = escapeHtml(
        [sessao.cidade, sessao.estado].filter(Boolean).join(" · ") ||
          "Cidade não identificada",
      );
      L.circleMarker([lat, lng], {
        radius: 9,
        color: "#04170f",
        weight: 1,
        fillColor: COLORS[sessao.etapa],
        fillOpacity: 0.95,
      })
        .bindPopup(`<strong>${cidade}</strong><br>${FUNIL_LABEL[sessao.etapa]}`)
        .addTo(map);
    });
  }, [ready, sessoes]);

  return (
    <div
      ref={root}
      className="h-[360px] w-full overflow-hidden rounded-[24px] bg-[#dbe4d0] sm:h-[440px]"
    />
  );
}
