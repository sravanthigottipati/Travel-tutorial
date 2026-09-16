"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SaveTripButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSessionId: sessionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't save trip.");
        return;
      }

      router.push(`/trips/${data.trip.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" onClick={handleClick} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save as trip"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
