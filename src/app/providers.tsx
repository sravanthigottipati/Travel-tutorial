"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* attribute="class" toggles the .dark class globals.css already
          defines full dark-mode CSS variables for — that class just had
          nothing switching it on before this. Theme is set from the
          Profile page (see profile/theme-toggle.tsx) rather than a
          floating badge, which was removed per feedback. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
