import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { LeadsMetaBoard } from "@/components/admin/LeadsMetaBoard";
import { isAdmin } from "@/lib/admin-auth";
import { listInscricoes } from "@/lib/admin-data";
import { listLeadsMeta } from "@/lib/leads-meta";
import { redirect } from "next/navigation";

function SetupCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] bg-white p-8 text-ink">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink/65">
        {children}
      </div>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const { aba } = await searchParams;
  const tab = aba === "meta" ? "meta" : "perfis";

  const [{ data, error }, leadsResult] = await Promise.all([
    listInscricoes(),
    listLeadsMeta(),
  ]);

  const metaCount =
    leadsResult.error && leadsResult.error !== "sql-missing"
      ? 0
      : leadsResult.data.length;

  return (
    <main className="min-h-[100svh] bg-[#f3efe4] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[28px] bg-green-deep px-6 py-6 sm:px-8">
          <AdminHeader
            total={tab === "meta" ? metaCount : data.length}
            title={tab === "meta" ? "Leads Meta" : "Perfis recebidos"}
            showExcel={tab === "perfis"}
          />
        </div>

        <AdminTabs aba={tab} perfis={data.length} meta={metaCount} />

        {tab === "meta" ? (
          leadsResult.error && leadsResult.error !== "sql-missing" ? (
            <SetupCard title="Não foi possível carregar os leads da Meta">
              <p>{leadsResult.error}</p>
            </SetupCard>
          ) : (
            <LeadsMetaBoard
              leads={leadsResult.data}
              sqlMissing={leadsResult.error === "sql-missing"}
            />
          )
        ) : error === "sql-missing" ? (
          <SetupCard title="Falta configurar o banco">
            <p>
              Rode o arquivo <code className="rounded bg-cream px-1.5 py-0.5">supabase/admin.sql</code> no{" "}
              <a
                className="font-semibold text-green underline"
                href="https://supabase.com/dashboard/project/acbksachtpypwtbgwyxh/sql/new"
                target="_blank"
                rel="noreferrer"
              >
                SQL Editor do Supabase
              </a>
              . Depois atualize esta página.
            </p>
          </SetupCard>
        ) : error === "secret-mismatch" ? (
          <SetupCard title="A senha do admin não bate com o banco">
            <p>
              O <code className="rounded bg-cream px-1.5 py-0.5">ADMIN_PASSWORD</code> do
              .env.local precisa ser o mesmo valor da tabela{" "}
              <code className="rounded bg-cream px-1.5 py-0.5">admin_settings</code>.
              Rode de novo o <code className="rounded bg-cream px-1.5 py-0.5">supabase/admin.sql</code>.
            </p>
          </SetupCard>
        ) : error === "env" ? (
          <SetupCard title="Falta a senha no ambiente">
            <p>
              Defina <code className="rounded bg-cream px-1.5 py-0.5">ADMIN_PASSWORD</code> no
              .env.local e reinicie o servidor.
            </p>
          </SetupCard>
        ) : error ? (
          <SetupCard title="Não foi possível carregar os perfis">
            <p>{error}</p>
          </SetupCard>
        ) : (
          <AdminBoard inscricoes={data} />
        )}
      </div>
    </main>
  );
}
