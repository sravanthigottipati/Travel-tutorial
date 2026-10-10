"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Scenario, WhatIfResult } from "@/lib/planner/what-if";

type Props = { tripId: string; dayNumbers: number[]; durationDays: number };

const format = (n: number) => n.toLocaleString("en-IN");

export function WhatIfPanel({ tripId, dayNumbers, durationDays }: Props) {
  const router = useRouter();
  const [rainDay, setRainDay] = useState(dayNumbers[0] ?? 1);
  const [active, setActive] = useState<Scenario | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function run(scenario: Scenario) {
    setActive(scenario);
    setResult(null);
    setApplied(false);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!active) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: active, apply: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't apply this change.");
        return;
      }
      setApplied(true);
      router.refresh();
    } catch {
      setError("Couldn't apply this change.");
    } finally {
      setApplying(false);
    }
  }

  const hasChange = result && (result.dayDiffs.length > 0 || result.after.total !== result.before.total);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pick a scenario</CardTitle>
          <CardDescription>Nothing changes until you press Apply.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => run({ type: "budget", percent: -20 })}>
              Budget −20%
            </Button>
            <Button variant="outline" size="sm" onClick={() => run({ type: "budget", percent: 20 })}>
              Budget +20%
            </Button>
            <Button variant="outline" size="sm" onClick={() => run({ type: "days", delta: 1 })}>
              Add a day
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={durationDays <= 1}
              onClick={() => run({ type: "days", delta: -1 })}
            >
              Remove a day
            </Button>
          </div>
          {dayNumbers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">It rains on day</span>
              <select
                value={rainDay}
                onChange={(e) => setRainDay(Number(e.target.value))}
                aria-label="Rainy day"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {dayNumbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => run({ type: "rain", dayNumber: rainDay })}>
                Show me
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Working it out…</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Before → After</CardTitle>
            {result.note && <CardDescription>{result.note}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Now</p>
                <p className="font-medium">{result.before.durationDays} days · budget {format(result.before.budget)}</p>
                <p>Estimated total {format(result.before.total)}</p>
              </div>
              <div className="rounded-lg border border-primary p-3">
                <p className="text-xs text-muted-foreground">With this change</p>
                <p className="font-medium">{result.after.durationDays} days · budget {format(result.after.budget)}</p>
                <p>
                  Estimated total {format(result.after.total)}{" "}
                  <span className={result.after.total <= result.before.total ? "text-green-600" : "text-destructive"}>
                    ({result.after.total >= result.before.total ? "+" : "−"}
                    {format(Math.abs(result.after.total - result.before.total))})
                  </span>
                </p>
              </div>
            </div>

            {result.dayDiffs.length > 0 ? (
              <div className="flex flex-col gap-2">
                {result.dayDiffs.map((d) => (
                  <div key={d.dayNumber} className="rounded-lg border border-border p-3 text-sm">
                    <p className="mb-1 font-medium">Day {d.dayNumber}</p>
                    {d.removed.map((name) => (
                      <p key={`r-${name}`} className="text-destructive">− {name}</p>
                    ))}
                    {d.added.map((name) => (
                      <p key={`a-${name}`} className="text-green-600">+ {name}</p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              !result.note && <p className="text-sm text-muted-foreground">No activities would change.</p>
            )}

            {hasChange && !applied && (
              <div className="flex flex-col gap-1">
                <Button className="self-start" onClick={apply} disabled={applying}>
                  {applying ? "Applying…" : "Apply this change"}
                </Button>
                {active?.type !== "rain" && (
                  <p className="text-xs text-muted-foreground">
                    This regenerates the itinerary, so any manual edits to it will be replaced.
                  </p>
                )}
              </div>
            )}
            {applied && <p className="text-sm text-green-600">Applied — your trip has been updated.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
