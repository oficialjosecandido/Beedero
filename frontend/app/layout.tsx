import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ForegroundPushListener } from "@/components/ForegroundPushListener";
import { Footer } from "@/components/Footer";
import { InstallPwaPrompt } from "@/components/InstallPwaPrompt";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SitePageViewBeacon } from "@/components/SitePageViewBeacon";
import { siteMetadata } from "@/lib/site-metadata";
import "./globals.css";

const clashGrotesk = localFont({
  src: [
    { path: "../public/fonts/ClashGrotesk-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Semibold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/ClashGrotesk-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-clash",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${clashGrotesk.variable} ${geistMono.variable} h-full antialiased`}
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
