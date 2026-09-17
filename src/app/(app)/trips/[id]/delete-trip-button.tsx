"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

// Was a native `confirm()` before — replaced with the same in-app
// AlertDialog used for the chat's "New chat" confirmation, both for a
// consistent look and because native dialogs can be suppressed in some
// browser contexts (e.g. sandboxed iframes without allow-modals), which
// would make this button silently do nothing on click. Also fixes a real
// bug: the DELETE response was never checked, so a failed delete (401,
// 404, network error) still navigated away and looked successful.
export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't delete this trip. Try again.");
        return;
      }
      router.push("/trips");
      router.refresh();
    } catch {
      setError("Couldn't delete this trip. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete trip
      </Button>
      <AlertDialogPortal>
        <AlertDialogPopup>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone — the trip, its itinerary and its budget will all be
            removed.
          </AlertDialogDescription>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete trip"}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
