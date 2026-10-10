import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { SITE } from "@/lib/site";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `Free Shopify Tools | ${SITE.fullName}`, template: `%s | ${SITE.fullName}` },
  description:
    "Free AI-powered tools for Shopify merchants and developers: PDP CRO audit, speed audit with Shopify fixes, and a store stack detector. By Script Commerce.",
  openGraph: { siteName: SITE.fullName, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#05060a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body>
        <div className="bg-decor" aria-hidden="true">
          <div className="grid" />
          <div className="orb one" />
          <div className="orb two" />
          <div className="orb three" />
        </div>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`} strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.gaId}');`}
        </Script>
      </body>
    </html>
  );
}
