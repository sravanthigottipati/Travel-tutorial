"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialTravelStyle: string;
  initialFoodPreference: string;
  initialInterests: string[];
};

export function ProfileForm({
  initialTravelStyle,
  initialFoodPreference,
  initialInterests,
}: Props) {
  const [travelStyle, setTravelStyle] = useState(initialTravelStyle);
  const [foodPreference, setFoodPreference] = useState(initialFoodPreference);
  const [interests, setInterests] = useState(initialInterests.join(", "));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        travelStyle: travelStyle || undefined,
        foodPreference: foodPreference || undefined,
        interests: interests
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean),
      }),
    });

    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="travelStyle">Travel style</Label>
        <Input
          id="travelStyle"
          placeholder="e.g. budget, luxury, backpacking"
          value={travelStyle}
          onChange={(e) => setTravelStyle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="foodPreference">Food preference</Label>
        <Input
          id="foodPreference"
          placeholder="e.g. vegetarian"
          value={foodPreference}
          onChange={(e) => setFoodPreference(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="interests">Interests</Label>
        <Input
          id="interests"
          placeholder="e.g. beaches, photography, local food"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save preferences"}
        </Button>
        {status === "saved" && (
          <span className="text-sm text-muted-foreground">Saved.</span>
        )}
        {status === "error" && (
          <span className="text-sm text-destructive">Couldn&apos;t save. Try again.</span>
        )}
      </div>
    </form>
  );
}
