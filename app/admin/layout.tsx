import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Processo Seletivo Agnes Pimentel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
