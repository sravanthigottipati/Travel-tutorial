"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import {
  SPEND_CATEGORIES,
  SPEND_CATEGORY_LABELS,
  summarizeSpending,
  type SpendCategory,
} from "@/lib/planner/trip-tracking";

export type SpendEntryView = {
  id: string;
  amount: number;
  category: SpendCategory;
  note: string | null;
  spentAt: string;
};

const format = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function SpendingCard({
  tripId,
  budget,
  initialEntries,
}: {
  tripId: string;
  budget: number;
  initialEntries: SpendEntryView[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<SpendCategory>("FOOD");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = summarizeSpending(entries, budget);
  const amountNumber = Number(amount);
  const amountValid = amount.trim() !== "" && amountNumber > 0 && amountNumber <= 10_000_000;
  const over = summary.remaining < 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!amountValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/spending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amountNumber * 100) / 100,
          category,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      setEntries((prev) => [data.entry, ...prev]);
      setAmount("");
      setNote("");
    } catch {
      setError("Couldn't save that. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const before = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const res = await fetch(`/api/trips/${tripId}/spending/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setEntries(before);
      setError("Couldn't delete that entry.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending</CardTitle>
        <CardDescription>Log what you actually spend and see it against your budget.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-lg font-semibold">{format(summary.total)}</span>{" "}
              <span className="text-muted-foreground">spent of {format(budget)}</span>
            </span>
            <span className={over ? "font-medium text-destructive" : "font-medium text-green-600"}>
              {over ? `Over by ${format(-summary.remaining)}` : `${format(summary.remaining)} left`}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Budget used"
            aria-valuenow={Math.min(summary.percentOfBudget, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-green-600")}
              style={{ width: `${Math.min(summary.percentOfBudget, 100)}%` }}
            />
          </div>
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.entries(summary.byCategory) as [SpendCategory, number][]).map(([cat, value]) => (
                <span key={cat} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {SPEND_CATEGORY_LABELS[cat]} {format(value)}
                </span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            placeholder="Amount"
            aria-label="Amount spent"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SpendCategory)}
            aria-label="Category"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {SPEND_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SPEND_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <Input
            placeholder="What for? (optional)"
            aria-label="Note"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-40 flex-1"
          />
          <Button type="submit" size="sm" disabled={!amountValid || busy}>
            {busy ? "Saving…" : "Add"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {entries.length > 0 && (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{e.note || SPEND_CATEGORY_LABELS[e.category]}</span>
                  <span className="text-xs text-muted-foreground">
                    {SPEND_CATEGORY_LABELS[e.category]} ·{" "}
                    {new Date(e.spentAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium">{format(e.amount)}</span>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    aria-label={`Delete ${e.note || SPEND_CATEGORY_LABELS[e.category]} entry`}
                    className="rounded px-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
