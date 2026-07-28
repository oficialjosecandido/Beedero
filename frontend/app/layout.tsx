import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { Footer } from "@/components/Footer";
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
        {children}
        <Footer />
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
