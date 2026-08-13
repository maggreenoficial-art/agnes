import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getInscricao } from "@/lib/admin-data";
import { attachmentFileName, fileBaseName } from "@/lib/export/fields";
import { buildProfilePdf } from "@/lib/export/pdf";

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

  const bytes = await buildProfilePdf(perfil);
  const filename = fileBaseName(perfil);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentFileName(filename, "pdf"),
      "Cache-Control": "no-store",
    },
  });
}
