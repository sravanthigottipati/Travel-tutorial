"use client";

import dynamic from "next/dynamic";

// TTPreferences reads localStorage directly during render (its position
// state's initializer) and depends on next-themes' resolved theme, both
// of which only make sense client-side — ssr: false skips server
// rendering entirely, the same pattern this app already uses for the
// Leaflet map (see trips/[id]/map/map-loader.tsx), so there's no
// server/client markup to reconcile at all.
export const TTPreferencesLoader = dynamic(
  () => import("./tt-preferences").then((mod) => mod.TTPreferences),
  { ssr: false }
);
