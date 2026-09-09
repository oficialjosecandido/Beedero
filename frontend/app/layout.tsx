import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ForegroundPushListener } from "@/components/ForegroundPushListener";
import { Footer } from "@/components/Footer";
import { InstallPwaPrompt } from "@/components/InstallPwaPrompt";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SitePageViewBeacon } from "@/components/SitePageViewBeacon";
import { siteMetadata } from "@/lib/site-metadata";
import "./globals.css";

// WOFF2 rather than TTF: same glyph set and metrics, ~19KB per weight
// instead of ~60KB. These gate LCP on text-only pages, so the ~165KB
// saved across the four weights comes straight off first paint.
const clashGrotesk = localFont({
  src: [
    { path: "../public/fonts/ClashGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-clash",
  display: "swap",
});

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  themeColor: "#050604",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${clashGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full w-full flex-col overflow-x-hidden bg-beedero-white text-beedero-black">
        <SitePageViewBeacon />
        <ServiceWorkerRegistration />
        <ForegroundPushListener />
        {children}
        <Footer />
        <InstallPwaPrompt />
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
