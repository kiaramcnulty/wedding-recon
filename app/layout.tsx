import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Toaster } from "@/components/ui/sonner";

// Absolute base for Open Graph / icon URLs — social crawlers (iMessage, X,
// Facebook) require absolute image URLs, so relative metadata paths resolve
// against this. Set NEXT_PUBLIC_SITE_URL per environment; fall back to prod.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://weddingrecon.com";
const DESCRIPTION = "Explore local wedding vendors and share your own recon.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Wedding Recon",
    template: "%s · Wedding Recon",
  },
  description: DESCRIPTION,
  applicationName: "Wedding Recon",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Wedding Recon", statusBarStyle: "default" },
  // og:image is supplied automatically by app/opengraph-image.png (Next's file
  // convention), rendered absolute via metadataBase above.
  openGraph: {
    type: "website",
    siteName: "Wedding Recon",
    title: "Wedding Recon",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wedding Recon",
    description: DESCRIPTION,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1D9E75",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
