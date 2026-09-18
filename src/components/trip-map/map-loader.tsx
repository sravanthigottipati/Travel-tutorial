"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so it can only run client-side.
// `ssr: false` is only allowed from a Client Component, hence this thin
// wrapper around the actual map component.
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export function MapLoader(props: { lat: number; lon: number; label: string }) {
  return <LeafletMap {...props} />;
}
