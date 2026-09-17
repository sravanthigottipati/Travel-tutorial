"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RecalculateBudgetButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isRecalculating, setIsRecalculating] = useState(false);

  async function handleClick() {
    setIsRecalculating(true);
    try {
      await fetch("/api/budget/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      router.refresh();
    } finally {
      setIsRecalculating(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isRecalculating}>
      {isRecalculating ? "Recalculating…" : "Recalculate budget"}
    </Button>
  );
}
