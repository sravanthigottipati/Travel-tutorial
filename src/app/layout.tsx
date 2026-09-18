import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The brand wordmark's font (see --font-display in globals.css) — Satoshi
// specifically, not a general heading font. Not on Google Fonts, so it's
// self-hosted via next/font/local instead of next/font/google, same
// zero-layout-shift/no-external-request optimization either way. The
// variable-weight file covers 300–900 in one file — see
// src/assets/fonts/SATOSHI-LICENSE.txt for Fontshare's free-use terms.
const satoshi = localFont({
  src: "../assets/fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
});

export const metadata: Metadata = {
  title: "Travel Tutorial",
  description: "Plan trips in plain language and get a personalized itinerary, budget and recommendations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${satoshi.variable} h-full antialiased`}
      // next-themes sets the .dark class on this element client-side
      // (before paint, via an injected script) based on saved/system
      // preference — that legitimately makes the server-rendered and
      // client-rendered class list differ, which React would otherwise
      // warn about as a hydration mismatch.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
