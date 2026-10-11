import { z } from "zod";
import { generateItinerary } from "@/lib/planner/itinerary-engine";
import { getCandidatePlaces } from "@/lib/planner/destinations";
import { buildBudgetSummary } from "@/lib/budget/budget-engine";

export const scenarioSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("budget"), percent: z.number().int().min(-50).max(50) }),
  // An exact new budget, in the trip's own currency (same ceiling as trip-schema.ts).
  z.object({ type: z.literal("setBudget"), amount: z.number().int().min(1).max(100_000_000) }),
  z.object({ type: z.literal("days"), delta: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ type: z.literal("rain"), dayNumber: z.number().int().min(1).max(60) }),
]);

export type Scenario = z.infer<typeof scenarioSchema>;

export type SnapshotActivity = {
  id?: string;
  name: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  estimatedCost: number;
  notes: string | null;
};

export type TripSnapshot = {
  destination: string;
  durationDays: number;
  travelers: number;
  budget: number;
  days: { dayNumber: number; activities: SnapshotActivity[] }[];
};

export type Outcome = {
  durationDays: number;
  budget: number;
  total: number;
  withinBudget: boolean | null;
  days: { dayNumber: number; activities: { name: string; estimatedCost: number }[] }[];
};

export type DayDiff = { dayNumber: number; removed: string[]; added: string[] };

export type RainSwap = { activityId: string; replaceWith: SnapshotActivity };

export type WhatIfResult = {
  before: Outcome;
  after: Outcome;
  dayDiffs: DayDiff[];
  note: string | null;
  rainSwaps: RainSwap[];
};

const MAX_DAYS = 60;
const OUTDOOR = new Set(["beaches", "trekking", "hiking", "adventure", "wildlife"]);
const INDOOR = new Set(["museums", "culture", "local food", "food", "shopping"]);

function outcomeFromSnapshot(trip: TripSnapshot, durationDays = trip.durationDays, budget = trip.budget): Outcome {
  const activitiesCost = trip.days.reduce(
    (sum, d) => sum + d.activities.reduce((s, a) => s + a.estimatedCost, 0),
    0
  );
  const summary = buildBudgetSummary(durationDays, trip.travelers, trip.destination, activitiesCost, budget);
  return {
    durationDays,
    budget,
    total: summary.total,
    withinBudget: summary.withinBudget,
    days: trip.days.map((d) => ({
      dayNumber: d.dayNumber,
      activities: d.activities.map((a) => ({ name: a.name, estimatedCost: a.estimatedCost })),
    })),
  };
}

function outcomeFromPlan(trip: TripSnapshot, durationDays: number, budget: number, interests: string[]): Outcome {
  const plan = generateItinerary({
    destination: trip.destination,
    durationDays,
    travelers: trip.travelers,
    budget,
    interests,
  });
  const summary = buildBudgetSummary(durationDays, trip.travelers, trip.destination, plan.totalEstimatedCost, budget);
  return {
    durationDays,
    budget,
    total: summary.total,
    withinBudget: summary.withinBudget,
    days: plan.days.map((d) => ({
      dayNumber: d.dayNumber,
      activities: d.activities.map((a) => ({ name: a.name, estimatedCost: a.estimatedCost })),
    })),
  };
}

function diffDays(before: Outcome, after: Outcome): DayDiff[] {
  const dayNumbers = Array.from(
    new Set([...before.days.map((d) => d.dayNumber), ...after.days.map((d) => d.dayNumber)])
  ).sort((a, b) => a - b);

  return dayNumbers
    .map((dayNumber) => {
      const b = before.days.find((d) => d.dayNumber === dayNumber)?.activities.map((a) => a.name) ?? [];
      const a = after.days.find((d) => d.dayNumber === dayNumber)?.activities.map((x) => x.name) ?? [];
      return {
        dayNumber,
        removed: b.filter((name) => !a.includes(name)),
        added: a.filter((name) => !b.includes(name)),
      };
    })
    .filter((d) => d.removed.length > 0 || d.added.length > 0);
}

// Swaps a rainy day's outdoor activities for indoor ones from the curated
// list that aren't already somewhere in the trip. Only activities that match
// a curated place by name are judged outdoor — anything else (e.g. an
// activity the user added by hand) is left alone rather than guessed at.
export function planRainSwaps(trip: TripSnapshot, dayNumber: number): RainSwap[] {
  const day = trip.days.find((d) => d.dayNumber === dayNumber);
  if (!day) return [];

  const candidates = getCandidatePlaces(trip.destination);
  const categoryOf = (name: string) => candidates.find((c) => c.name === name)?.category;
  const used = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.name)));
  const pool = candidates.filter((c) => INDOOR.has(c.category) && !used.has(c.name));

  const swaps: RainSwap[] = [];
  for (const activity of day.activities) {
    const category = categoryOf(activity.name);
    if (!activity.id || !category || !OUTDOOR.has(category)) continue;
    const replacement = pool.shift();
    if (!replacement) break;
    swaps.push({
      activityId: activity.id,
      replaceWith: {
        name: replacement.name,
        location: replacement.location ?? trip.destination,
        startTime: activity.startTime,
        endTime: activity.endTime,
        estimatedCost: replacement.estimatedCost * trip.travelers,
        notes: "Indoor swap for a rainy day",
      },
    });
  }
  return swaps;
}

export function simulateScenario(trip: TripSnapshot, scenario: Scenario, interests: string[]): WhatIfResult {
  const before = outcomeFromSnapshot(trip);

  if (scenario.type === "setBudget" && scenario.amount === Math.round(trip.budget)) {
    return { before, after: before, dayDiffs: [], note: "That's already your budget.", rainSwaps: [] };
  }

  if (scenario.type === "budget" || scenario.type === "setBudget") {
    const newBudget =
      scenario.type === "setBudget"
        ? scenario.amount
        : Math.max(1, Math.round(trip.budget * (1 + scenario.percent / 100)));
    const after = outcomeFromPlan(trip, trip.durationDays, newBudget, interests);
    return { before, after, dayDiffs: diffDays(before, after), note: null, rainSwaps: [] };
  }

  if (scenario.type === "days") {
    const newDays = Math.min(Math.max(trip.durationDays + scenario.delta, 1), MAX_DAYS);
    if (newDays === trip.durationDays) {
      return { before, after: before, dayDiffs: [], note: "A trip needs at least one day.", rainSwaps: [] };
    }
    const after = outcomeFromPlan(trip, newDays, trip.budget, interests);
    return { before, after, dayDiffs: diffDays(before, after), note: null, rainSwaps: [] };
  }

  const dayExists = trip.days.some((d) => d.dayNumber === scenario.dayNumber);
  if (!dayExists) {
    return { before, after: before, dayDiffs: [], note: `Day ${scenario.dayNumber} isn't in this itinerary yet.`, rainSwaps: [] };
  }
  const swaps = planRainSwaps(trip, scenario.dayNumber);
  if (swaps.length === 0) {
    const candidates = getCandidatePlaces(trip.destination);
    const day = trip.days.find((d) => d.dayNumber === scenario.dayNumber);
    const hasOutdoor = day?.activities.some((a) => {
      const category = candidates.find((c) => c.name === a.name)?.category;
      return category !== undefined && OUTDOOR.has(category);
    });
    return {
      before,
      after: before,
      dayDiffs: [],
      note: hasOutdoor
        ? `Day ${scenario.dayNumber} has outdoor plans, but every indoor alternative we know for ${trip.destination} is already in your itinerary, so there is nothing new to swap in.`
        : `Day ${scenario.dayNumber} has no outdoor activities we can swap, so rain wouldn't change the plan.`,
      rainSwaps: [],
    };
  }
  const swapped: TripSnapshot = {
    ...trip,
    days: trip.days.map((d) =>
      d.dayNumber !== scenario.dayNumber
        ? d
        : {
            ...d,
            activities: d.activities.map((a) => swaps.find((s) => s.activityId === a.id)?.replaceWith ?? a),
          }
    ),
  };
  const after = outcomeFromSnapshot(swapped);
  return { before, after, dayDiffs: diffDays(before, after), note: null, rainSwaps: swaps };
}
