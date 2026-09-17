"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (!confirm("Delete this trip? This can't be undone.")) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      router.push("/trips");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button variant="destructive" onClick={handleClick} disabled={isDeleting}>
      {isDeleting ? "Deleting…" : "Delete trip"}
    </Button>
  );
}
