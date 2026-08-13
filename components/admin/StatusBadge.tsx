import {
  STATUS_LABEL,
  type InscricaoStatus,
} from "@/lib/inscricao";

const STYLES: Record<InscricaoStatus, string> = {
  nova: "bg-lime text-ink",
  em_analise: "bg-gold/90 text-ink",
  aprovada: "bg-green text-white",
  reprovada: "bg-ink/10 text-ink/55",
};

export function StatusBadge({ status }: { status: InscricaoStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
