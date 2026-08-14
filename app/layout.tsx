import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { MetaPageView } from "@/components/MetaPixel";
import { FunilPresence } from "@/components/FunilPresence";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.agnespimentel.com"),
  title: "Processo Seletivo | Agnes Pimentel + Mix Models",
  description:
    "Inscreva-se para a seleção presencial da Mix Models Agency, idealizada por Agnes Pimentel, na quadra da Imperatriz Leopoldinense.",
  openGraph: {
    title: "Processo Seletivo | Agnes Pimentel + Mix Models",
    description:
      "Quer dar o primeiro passo na carreira de modelo? Inscreva-se até 07 de setembro.",
    url: "https://www.agnespimentel.com",
    images: ["/campaign/agnes-selecao.png"],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-green-deep font-sans text-cream">
        {children}
        <Script id="meta-pixel" strategy="beforeInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1523707485735767');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height={1}
            width={1}
            style={{ display: "none" }}
            alt=""
            src="https://www.facebook.com/tr?id=1523707485735767&ev=PageView&noscript=1"
          />
        </noscript>
        <Suspense fallback={null}>
          <MetaPageView />
        </Suspense>
        <Suspense fallback={null}>
          <FunilPresence />
        </Suspense>
      </body>
    </html>
  );
}
