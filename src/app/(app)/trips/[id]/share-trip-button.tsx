"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  tripId: string;
  initialShareToken: string | null;
};

// Read-only sharing: the link needs no login and grants no edit access —
// see the /shared/[token] page. Turning it on/off never touches the
// underlying trip data, only whether that one token resolves to anything.
export function ShareTripButton({ tripId, initialShareToken }: Props) {
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/shared/${shareToken}`
      : null;

  async function handleEnable() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't enable sharing.");
        return;
      }
      setShareToken(data.shareToken);
    } catch {
      setError("Couldn't enable sharing.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRevoke() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't stop sharing.");
        return;
      }
      setShareToken(null);
      setCopied(false);
    } catch {
      setError("Couldn't stop sharing.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — you can select and copy the link manually.");
    }
  }

  if (!shareToken) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" onClick={handleEnable} disabled={isLoading}>
          {isLoading ? "Enabling…" : "Share trip"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border border-border p-3">
      <span className="text-xs text-muted-foreground">
        Anyone with this link can view (not edit) this trip — no account needed.
      </span>
      <div className="flex gap-2">
        <Input value={shareUrl ?? ""} readOnly onFocus={(e) => e.currentTarget.select()} />
        <Button size="sm" variant="outline" onClick={handleCopy} disabled={!shareUrl}>
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button size="sm" variant="destructive" onClick={handleRevoke} disabled={isLoading}>
          {isLoading ? "…" : "Stop sharing"}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
