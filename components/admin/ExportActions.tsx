export function ExportActions({ id }: { id: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
        Exportar ficha
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/admin/${id}/export/pdf`}
          className="rounded-full bg-green px-4 py-2 text-sm font-bold text-white hover:bg-green-mid"
        >
          Baixar PDF
        </a>
        <a
          href={`/admin/${id}/export/excel`}
          className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/80"
        >
          Baixar Excel
        </a>
      </div>
    </div>
  );
}
