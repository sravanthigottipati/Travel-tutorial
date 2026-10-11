"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Scenario, WhatIfResult } from "@/lib/planner/what-if";

type Props = { tripId: string; dayNumbers: number[]; durationDays: number; budget: number };

const format = (n: number) => n.toLocaleString("en-IN");

// Whether the estimated total fits the budget — the answer a budget change is really asked for.
function Fit({ outcome }: { outcome: WhatIfResult["after"] }) {
  const gap = outcome.budget - outcome.total;
  return gap >= 0 ? (
    <p className="text-xs text-green-600">Within budget — {format(gap)} to spare</p>
  ) : (
    <p className="text-xs text-destructive">Over budget by {format(-gap)}</p>
  );
}

export function WhatIfPanel({ tripId, dayNumbers, durationDays, budget }: Props) {
  const router = useRouter();
  const [budgetDraft, setBudgetDraft] = useState(String(Math.round(budget)));
  const newBudget = Number(budgetDraft);
  const budgetValid = budgetDraft.trim() !== "" && Number.isInteger(newBudget) && newBudget >= 1 && newBudget <= 100_000_000;
  const lastDay = dayNumbers.length > 0 ? Math.max(...dayNumbers) : 1;
  const [rainDayDraft, setRainDayDraft] = useState(String(dayNumbers[0] ?? 1));
  const rainDay = Number(rainDayDraft);
  const rainDayValid = rainDayDraft.trim() !== "" && dayNumbers.includes(rainDay);
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

  const hasChange =
    result &&
    (result.dayDiffs.length > 0 ||
      result.after.total !== result.before.total ||
      result.after.budget !== result.before.budget ||
      result.after.durationDays !== result.before.durationDays);

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
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (budgetValid) run({ type: "setBudget", amount: newBudget });
            }}
          >
            <label htmlFor="new-budget" className="text-sm text-muted-foreground">
              Change budget to
            </label>
            <Input
              id="new-budget"
              type="number"
              inputMode="numeric"
              min={1}
              max={100_000_000}
              step={1}
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              className="w-36"
            />
            {budgetValid && newBudget !== budget && (
              <span className={newBudget > budget ? "text-xs text-green-600" : "text-xs text-destructive"}>
                {newBudget > budget ? "+" : "−"}
                {format(Math.abs(newBudget - budget))} from {format(budget)}
              </span>
            )}
            <Button type="submit" variant="outline" size="sm" disabled={!budgetValid}>
              Show me
            </Button>
          </form>
          {dayNumbers.length > 0 && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (rainDayValid) run({ type: "rain", dayNumber: rainDay });
              }}
            >
              <label htmlFor="rain-day" className="text-sm text-muted-foreground">
                It rains on day
              </label>
              <Input
                id="rain-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={lastDay}
                step={1}
                value={rainDayDraft}
                onChange={(e) => setRainDayDraft(e.target.value)}
                className="w-20"
              />
              <span className={rainDayValid || rainDayDraft === "" ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                {rainDayValid || rainDayDraft === "" ? `of ${lastDay}` : `Enter a day from 1 to ${lastDay}`}
              </span>
              <Button type="submit" variant="outline" size="sm" disabled={!rainDayValid}>
                Show me
              </Button>
            </form>
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
                <Fit outcome={result.before} />
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
                <Fit outcome={result.after} />
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
              !result.note && (
                <p className="text-sm text-muted-foreground">
                  {result.moved.length > 0
                    ? "Same activities as now — only the order across days changes."
                    : result.after.total !== result.before.total
                      ? "The activities stay the same. The estimate changes because the budget sets the stay, food and transport tier."
                      : "No activities would change."}
                </p>
              )
            )}

            {result.moved.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Reordered:{" "}
                {result.moved.map((m) => `${m.name} (Day ${m.fromDay} → ${m.toDay})`).join(", ")}
              </p>
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
