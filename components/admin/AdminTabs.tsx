import Link from "next/link";

export function AdminTabs({
  aba,
  perfis,
  meta,
}: {
  aba: "perfis" | "meta";
  perfis: number;
  meta: number;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
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
    </nav>
  );
}
