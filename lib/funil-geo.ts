import { headers } from "next/headers";
import { decodeGeoText } from "@/lib/funil";

export type FunilGeo = {
  cidade: string;
  estado: string;
  pais: string;
  lat: number | null;
  lng: number | null;
};

function parseCoord(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function geoFromRequest(): Promise<FunilGeo> {
  const headerList = await headers();
  const cidade = decodeGeoText(headerList.get("x-vercel-ip-city"));
  const estado = decodeGeoText(headerList.get("x-vercel-ip-country-region"));
  const pais = decodeGeoText(headerList.get("x-vercel-ip-country")) || "BR";
  const lat = parseCoord(headerList.get("x-vercel-ip-latitude"));
  const lng = parseCoord(headerList.get("x-vercel-ip-longitude"));

  return {
    cidade: cidade || "Cidade não identificada",
    estado,
    pais,
    lat,
    lng,
  };
}
