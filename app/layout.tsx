import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "Processo Seletivo | Agnes Pimentel + Mix Models",
  description:
    "Inscreva-se para a seleção presencial da Mix Models Agency, idealizada por Agnes Pimentel, na quadra da Imperatriz Leopoldinense.",
  openGraph: {
    title: "Processo Seletivo | Agnes Pimentel + Mix Models",
    description:
      "Quer dar o primeiro passo na carreira de modelo? Inscreva-se até 07 de setembro.",
    images: ["/campaign/agnes-selecao.png"],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-green-deep font-sans text-cream">
        {children}
      </body>
    </html>
  );
}
