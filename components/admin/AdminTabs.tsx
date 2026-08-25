import Link from "next/link";

const META_LEADS = 1000;

export function AdminTabs({
  aba,
  perfis,
  meta,
  metaConfirmados,
}: {
  aba: "perfis" | "meta";
  perfis: number;
  meta: number;
  metaConfirmados: number;
}) {
  const total = perfis + metaConfirmados;
  const percent = Math.min(100, (total / META_LEADS) * 100);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link
        href="/admin"
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          aba === "perfis"
            ? "bg-lime text-ink"
            : "bg-white text-ink/60 hover:bg-white/80"
        }`}
      >
        Perfis do site
        <span className="ml-2">{perfis}</span>
      </Link>
      <Link
        href="/admin?aba=meta"
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          aba === "meta"
            ? "bg-lime text-ink"
            : "bg-white text-ink/60 hover:bg-white/80"
        }`}
      >
        Leads Meta
        <span className="ml-2">{meta}</span>
      </Link>
      <div className="ml-auto flex min-w-[180px] flex-col justify-center rounded-full bg-green-deep px-4 py-2 text-white">
        <p className="flex items-baseline justify-between gap-3 text-sm font-semibold leading-none">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">
            Total
          </span>
          <span>
            {total}
            <span className="text-white/45"> / {META_LEADS}</span>
          </span>
        </p>
        <span className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
          <span
            className="block h-full rounded-full bg-lime"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
    </nav>
  );
}
