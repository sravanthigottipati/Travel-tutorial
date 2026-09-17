"use client";

import dynamic from "next/dynamic";

// ssr: false avoids a hydration mismatch: which button shows "active"
// depends on next-themes' resolved theme, which isn't known during server
// rendering. Same pattern this app already uses for the Leaflet map (see
// trips/[id]/map/map-loader.tsx) rather than a mount-flag + effect.
export const ThemeToggleLoader = dynamic(
  () => import("./theme-toggle").then((mod) => mod.ThemeToggle),
  {
    ssr: false,
    loading: () => <div className="h-9 w-full rounded-lg border border-border" />,
  }
);
