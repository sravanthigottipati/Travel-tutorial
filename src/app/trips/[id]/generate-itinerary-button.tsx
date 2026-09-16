"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateItineraryButton({
  tripId,
  hasItinerary,
}: {
  tripId: string;
  hasItinerary: boolean;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleClick() {
    setIsGenerating(true);
    try {
      await fetch(`/api/trips/${tripId}/itinerary`, { method: "POST" });
      router.refresh();
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button variant={hasItinerary ? "outline" : "default"} onClick={handleClick} disabled={isGenerating}>
      {isGenerating ? "Generating…" : hasItinerary ? "Regenerate itinerary" : "Generate itinerary"}
    </Button>
  );
}
