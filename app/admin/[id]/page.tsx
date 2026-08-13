import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OfficialMarks } from "@/components/Brand";
import { ExportActions } from "@/components/admin/ExportActions";
import { CopyLink } from "@/components/CopyLink";
import { DeleteInscricao } from "@/components/admin/DeleteInscricao";
import { PhotoGallery } from "@/components/admin/PhotoGallery";
import { StatusActions } from "@/components/admin/StatusActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { logoutAdmin } from "@/app/admin/actions";
import { isAdmin } from "@/lib/admin-auth";
import { getInscricao } from "@/lib/admin-data";
import {
  formatDate,
  formatDateTime,
  idade,
  instagramUrl,
  whatsappUrl,
} from "@/lib/inscricao";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/35">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const perfil = await getInscricao(id);

  if (!perfil) {
    notFound();
  }

  const years = idade(perfil.data_nascimento);

  return (
    <main className="min-h-[100svh] bg-[#f3efe4] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-green-deep px-6 py-5">
          <div className="flex items-center gap-4">
            <OfficialMarks
              sealClassName="size-12"
              mixClassName="h-6 w-auto"
            />
            <Link
              href="/admin"
              className="text-sm font-semibold text-white/70 hover:text-lime"
            >
              ← Todos os perfis
            </Link>
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Sair
            </button>
          </form>
        </header>

        <section className="rounded-[28px] bg-white p-6 text-ink sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <StatusBadge status={perfil.status} />
              <h1 className="mt-3 font-display text-4xl font-semibold leading-snug">
                {perfil.nome_completo}
              </h1>
              <p className="mt-2 text-ink/55">
                {years !== null ? `${years} anos` : formatDate(perfil.data_nascimento)}{" "}
                · inscrita em {formatDateTime(perfil.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={instagramUrl(perfil.instagram)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-green px-4 py-2 text-sm font-bold text-white"
              >
                Instagram
              </a>
              <a
                href={whatsappUrl(perfil.telefone)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink"
              >
                WhatsApp
              </a>
              <a
                href={`mailto:${perfil.email}`}
                className="rounded-full bg-cream px-4 py-2 text-sm font-bold text-ink"
              >
                E-mail
              </a>
            </div>
          </div>

          <div className="mt-8">
            <PhotoGallery fotos={perfil.fotos} nome={perfil.nome_completo} />
          </div>

          <div className="mt-8">
            <ExportActions id={perfil.id} />
          </div>

          <div className="mt-8">
            <StatusActions id={perfil.id} status={perfil.status} />
            <div className="mt-4 rounded-2xl bg-cream p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
                Link da candidata
              </p>
              <p className="mt-1 mb-3 break-all text-sm text-ink/60">
                /acompanhar/{perfil.id}
              </p>
              <CopyLink path={`/acompanhar/${perfil.id}`} />
            </div>
          </div>

          <div className="mt-8 grid gap-6 border-t border-black/6 pt-8 sm:grid-cols-2">
            <Info label="Nascimento" value={formatDate(perfil.data_nascimento)} />
            <Info label="Telefone" value={perfil.telefone} />
            <Info label="E-mail" value={perfil.email} />
            <Info label="Instagram" value={perfil.instagram} />
            <div className="sm:col-span-2">
              <Info label="Endereço" value={perfil.endereco} />
            </div>
            <Info label="Altura" value={perfil.altura} />
            <Info label="Cintura" value={perfil.cintura} />
            <Info label="Quadril" value={perfil.quadril} />
            <Info label="Busto" value={perfil.busto || "—"} />
            <div className="sm:col-span-2">
              <Info
                label="Tatuagens ou piercings visíveis"
                value={perfil.tatuagens_piercings}
              />
            </div>
            <div className="sm:col-span-2">
              <Info
                label="Experiência"
                value={perfil.experiencia || "Não informada"}
              />
            </div>
          </div>

          <DeleteInscricao id={perfil.id} nome={perfil.nome_completo} />
        </section>
      </div>
    </main>
  );
}
