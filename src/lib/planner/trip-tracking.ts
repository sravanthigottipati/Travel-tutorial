import { z } from "zod";

export const ACTIVITY_STATUSES = ["PLANNED", "DONE", "SKIPPED"] as const;
export type ActivityStatusValue = (typeof ACTIVITY_STATUSES)[number];

export const SPEND_CATEGORIES = [
  "FOOD",
  "LOCAL_TRANSPORT",
  "ACTIVITIES",
  "ACCOMMODATION",
  "TRANSPORT",
  "MISCELLANEOUS",
] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export const SPEND_CATEGORY_LABELS: Record<SpendCategory, string> = {
  FOOD: "Food",
  LOCAL_TRANSPORT: "Local transport",
  ACTIVITIES: "Activities",
  ACCOMMODATION: "Stay",
  TRANSPORT: "Travel",
  MISCELLANEOUS: "Other",
};

export const MAX_SPEND_ENTRIES_PER_TRIP = 500;

export const activityStatusSchema = z.object({ status: z.enum(ACTIVITY_STATUSES) });

export const spendEntrySchema = z.object({
  amount: z
    .number()
    .positive()
    .max(10_000_000)
    .refine((n) => Math.round(n * 100) === n * 100, "At most two decimal places"),
  category: z.enum(SPEND_CATEGORIES),
  note: z.string().trim().max(120).optional(),
});

export type Progress = { done: number; skipped: number; planned: number; total: number; percent: number };

// Done and skipped both count as "dealt with" — skipping is a decision, not a gap.
export function summarizeProgress(activities: { status: ActivityStatusValue }[]): Progress {
  const done = activities.filter((a) => a.status === "DONE").length;
  const skipped = activities.filter((a) => a.status === "SKIPPED").length;
  const total = activities.length;
  return {
    done,
    skipped,
    planned: total - done - skipped,
    total,
    percent: total === 0 ? 0 : Math.round(((done + skipped) / total) * 100),
  };
}

export type Spending = {
  total: number;
  remaining: number;
  percentOfBudget: number;
  byCategory: Partial<Record<SpendCategory, number>>;
};

export function summarizeSpending(
  entries: { amount: number; category: SpendCategory }[],
  budget: number
): Spending {
  const byCategory: Partial<Record<SpendCategory, number>> = {};
  let total = 0;
  for (const e of entries) {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  total = Math.round(total * 100) / 100;
  return {
    total,
    remaining: Math.round((budget - total) * 100) / 100,
    percentOfBudget: budget > 0 ? Math.round((total / budget) * 100) : 0,
    byCategory,
  };
}

// Great-circle distance in km between two lat/lon points.
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function directionsUrl(place: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
}
