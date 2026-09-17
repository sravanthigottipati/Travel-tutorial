"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { TTPreferencesLoader } from "@/components/tt-preferences-loader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* attribute="class" toggles the .dark class globals.css already
          defines full dark-mode CSS variables for — that class just had
          nothing switching it on before this. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <TTPreferencesLoader />
      </ThemeProvider>
    </SessionProvider>
  );
}
