import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Análise de funil | Processo Seletivo Agnes Pimentel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function FunilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
