"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pdfFileName, type TripExport } from "@/lib/export/trip-export";

// Fetches the trip's latest data and builds the PDF in the browser, so the
// saved file can be opened later with no internet at all.
export function DownloadTripPdfButton({ tripId, size = "default" }: { tripId: string; size?: "default" | "sm" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/export`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't prepare the PDF.");
        return;
      }
      const trip = data.trip as TripExport;
      const { renderTripPdf } = await import("@/lib/export/trip-pdf");
      renderTripPdf(trip).save(pdfFileName(trip.destination));
    } catch {
      setError("Couldn't prepare the PDF. You need to be online to download it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="outline" size={size} onClick={download} disabled={busy}>
        {busy ? "Preparing PDF…" : "Download PDF (offline)"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
