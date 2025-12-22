import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "2025 한어울제 소개",
  description: "2025년 한어울제를 소개하고, 의견을 공유하는 사이트입니다.",
  icons: {
    icon: "/HSHS_LOGO.svg",
  },
  openGraph: {
    title: "2025 한어울제 소개",
    description: "2025년 한어울제를 소개하고, 의견을 공유하는 사이트입니다.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "2025 Haneuljae Festival",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "2025 한어울제 소개",
    description: "2025년 한어울제를 소개하고, 의견을 공유하는 사이트입니다.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "2025 Haneuljae Festival",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
