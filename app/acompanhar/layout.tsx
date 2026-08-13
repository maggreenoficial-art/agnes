import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acompanhar inscrição",
  robots: { index: false, follow: false },
};

export default function AcompanharLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
