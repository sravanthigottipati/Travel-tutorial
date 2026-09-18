import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
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

// The brand wordmark's font (see --font-display in globals.css) — an
// elegant, high-contrast serif for "Travel Tutorial" specifically, not a
// general heading font. Deliberately only loaded with the weights the
// wordmark actually uses.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Travel Tutorial",
  description: "Plan trips in plain language and get a personalized itinerary, budget and recommendations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
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
