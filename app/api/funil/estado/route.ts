import { isAdmin, getAdminSecret } from "@/lib/admin-auth";
import {
  isFunilEtapa,
  type FunilEstado,
  type FunilEtapa,
  type FunilSessao,
} from "@/lib/funil";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyHoje(): Record<FunilEtapa, number> {
  return {
    visitou: 0,
    formulario: 0,
    preenchendo: 0,
    fotos: 0,
    enviando: 0,
    inscrita: 0,
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("admin_funil_estado", {
    p_secret: getAdminSecret(),
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      error.code === "PGRST202" ||
      message.includes("could not find the function")
    ) {
      return Response.json({ error: "sql-missing" }, { status: 503 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  const raw = (data ?? {}) as Partial<FunilEstado> & {
    sessoes?: FunilSessao[];
    hoje?: Partial<Record<FunilEtapa, number>>;
  };

  const sessoes = Array.isArray(raw.sessoes)
    ? raw.sessoes.map((sessao) => ({
        ...sessao,
        etapa: isFunilEtapa(sessao.etapa) ? sessao.etapa : "visitou",
        campos: Array.isArray(sessao.campos) ? sessao.campos : [],
        fotos: Number(sessao.fotos) || 0,
      }))
    : [];

  const hoje = { ...emptyHoje(), ...(raw.hoje ?? {}) };

  return Response.json({
    online: Number(raw.online) || 0,
    visitantes_hoje: Number(raw.visitantes_hoje) || 0,
    inscritas_hoje: Number(raw.inscritas_hoje) || 0,
    inscritas_total: Number(raw.inscritas_total) || 0,
    hoje,
    sessoes,
  } satisfies FunilEstado);
}
