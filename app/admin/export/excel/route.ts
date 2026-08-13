import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listInscricoes } from "@/lib/admin-data";
import { attachmentFileName } from "@/lib/export/fields";
import { buildListExcel } from "@/lib/export/excel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { data, error } = await listInscricoes();
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const requested = new URL(request.url).searchParams.get("ids");
  const ids = requested
    ? new Set(requested.split(",").map((id) => id.trim()).filter(Boolean))
    : null;
  const rows = ids ? data.filter((item) => ids.has(item.id)) : data;

  const bytes = await buildListExcel(rows);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentFileName("perfis-processo-seletivo", "xlsx"),
      "Cache-Control": "no-store",
    },
  });
}
