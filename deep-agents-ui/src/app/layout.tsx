import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080B21",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://printway-nexus.vercel.app"),
  title: {
    default: "Printway Nexus | AI R&D Copilot & Cơ Hội Sản Phẩm Print On Demand",
    template: "%s | Printway Nexus",
  },
  description:
    "Printway Nexus - Hệ thống AI Copilot tự động cào tín hiệu thị trường Etsy, Amazon US & Pinterest, chấm điểm Opportunity Score 5D và kết nối xưởng sản xuất Printway VN.",
  keywords: [
    "print on demand",
    "printway",
    "printway nexus",
    "pod r&d",
    "nghiên cứu sản phẩm pod",
    "etsy trends 2026",
    "amazon pod research",
    "opportunity score",
    "print on demand vietnam",
    "dropshipping",
    "resend email reports",
  ],
  authors: [{ name: "Printway R&D Team", url: "https://printway.io" }],
  creator: "Printway.io",
  publisher: "Printway.io",
  alternates: {
    canonical: "https://printway-nexus.vercel.app",
    languages: {
      "vi-VN": "https://printway-nexus.vercel.app",
      "en-US": "https://printway-nexus.vercel.app",
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: ["en_US"],
    url: "https://printway-nexus.vercel.app",
    siteName: "Printway Nexus AI",
    title: "Printway Nexus | AI R&D Copilot & Cơ Hội Sản Phẩm Print On Demand",
    description:
      "Tự động quét tín hiệu thị trường Etsy, Amazon US & Pinterest, chấm điểm Opportunity Score 5D và kết nối xưởng sản xuất Printway VN.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Printway Nexus | AI R&D Copilot & POD Opportunity Discovery",
    description:
      "Tự động quét tín hiệu thị trường Etsy, Amazon US & Pinterest, chấm điểm Opportunity Score 5D và kết nối xưởng sản xuất Printway VN.",
    creator: "@printway_io",
    site: "@printway_io",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Printway Nexus",
  url: "https://printway-nexus.vercel.app",
  description:
    "AI Copilot phát hiện cơ hội sản phẩm Print-on-Demand (POD) xuyên biên giới thời gian thực qua Amazon, Etsy & Pinterest.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "Printway.io",
    url: "https://printway.io",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
