import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getInscricao } from "@/lib/admin-data";
import { attachmentFileName, fileBaseName } from "@/lib/export/fields";
import { buildProfileExcel } from "@/lib/export/excel";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", _request.url));
  }

  const { id } = await params;
  const perfil = await getInscricao(id);
  if (!perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const bytes = await buildProfileExcel(perfil);
  const filename = fileBaseName(perfil);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentFileName(filename, "xlsx"),
      "Cache-Control": "no-store",
    },
  });
}
