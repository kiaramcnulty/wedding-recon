import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display serif (Kiara, 2026-11-08: a more polished, bridal feel): the
// large titles only, via `font-display`. Body text and small labels stay in
// Geist, where a high-contrast serif would read thin.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

import { InAppHistoryTracker } from "@/components/in-app-history";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/site";

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
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <InAppHistoryTracker />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
