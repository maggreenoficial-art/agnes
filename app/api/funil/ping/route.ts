import { geoFromRequest } from "@/lib/funil-geo";
import { isFunilEtapa, isSessionId } from "@/lib/funil";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_CAMPOS = new Set([
  "nomeCompleto",
  "dataNascimento",
  "endereco",
  "telefone",
  "email",
  "instagram",
  "altura",
  "cintura",
  "quadril",
  "busto",
  "tatuagens",
  "experiencia",
  "fotos",
]);

export async function POST(request: Request) {
  let body: {
    sessionId?: string;
    pagina?: string;
    etapa?: string;
    campos?: string[];
    fotos?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() ?? "";
  if (!isSessionId(sessionId)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const etapa = isFunilEtapa(body.etapa ?? "") ? body.etapa : "visitou";
  const campos = (Array.isArray(body.campos) ? body.campos : [])
    .filter((campo): campo is string => typeof campo === "string")
    .map((campo) => campo.trim())
    .filter((campo) => ALLOWED_CAMPOS.has(campo))
    .slice(0, 20);
  const fotos = Math.max(0, Math.min(5, Number(body.fotos) || 0));
  const pagina = String(body.pagina ?? "/").slice(0, 200);
  const geo = await geoFromRequest();

  const { error } = await supabase.rpc("funil_ping", {
    p_id: sessionId,
    p_pagina: pagina,
    p_etapa: etapa,
    p_campos: campos,
    p_fotos: fotos,
    p_cidade: geo.cidade,
    p_estado: geo.estado,
    p_pais: geo.pais,
    p_lat: geo.lat,
    p_lng: geo.lng,
  });

  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
