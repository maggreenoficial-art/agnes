import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listInscricoes } from "@/lib/admin-data";
import { attachmentFileName } from "@/lib/export/fields";
import { audienceToCsv, buildEngajadosAudience } from "@/lib/export/meta-audience";
import { listLeadsMeta } from "@/lib/leads-meta";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const [{ data: inscricoes, error: inscricoesError }, leadsResult] =
    await Promise.all([listInscricoes(), listLeadsMeta()]);

  if (inscricoesError && inscricoesError !== "sql-missing") {
    return NextResponse.json({ error: inscricoesError }, { status: 500 });
  }
  if (leadsResult.error && leadsResult.error !== "sql-missing") {
    return NextResponse.json({ error: leadsResult.error }, { status: 500 });
  }

  const csv = audienceToCsv(
    buildEngajadosAudience(inscricoes, leadsResult.data),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentFileName(
        "engajados-meta-mix-models",
        "csv",
      ),
      "Cache-Control": "no-store",
    },
  });
}
