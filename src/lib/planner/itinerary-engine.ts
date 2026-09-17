import { getCandidatePlaces, type CandidatePlace } from "@/lib/planner/destinations";
import type { TripContext } from "@/lib/ai/trip-context";

// Implements the planning pipeline from Section 15.1:
//   Travel request -> Candidate places -> Preference filtering ->
//   (distance/grouping — deferred to Phase 8, no real maps data yet) ->
//   Time-slot assignment -> Budget impact calculation -> Validation ->
//   Day-wise itinerary.

export type PlannedActivity = {
  name: string;
  location: string | null;
  startTime: string;
  endTime: string;
  estimatedCost: number; // total for all travelers, this activity
  notes: string | null;
};

export type PlannedDay = {
  dayNumber: number;
  title: string;
  activities: PlannedActivity[];
};

export type ItineraryPlan = {
  days: PlannedDay[];
  totalEstimatedCost: number;
  warnings: string[];
};

const TIME_SLOTS = [
  { start: "09:00", end: "11:30" },
  { start: "13:00", end: "15:30" },
  { start: "16:30", end: "18:30" },
];

const MAX_ACTIVITIES_PER_DAY = TIME_SLOTS.length;

// Sorts candidates so places matching the traveler's stated interests come
// first (Preference filtering), without ever dropping the rest — a day with
// no perfect match still gets filled rather than left empty. Within each
// group (matching / not matching), cheaper candidates are surfaced first
// once a stated budget is tight — biasing candidate order toward
// affordability from the start does more for staying within budget than
// only warning about it after the fact.
function prioritizeByInterests(
  candidates: CandidatePlace[],
  interests: string[],
  preferCheaper: boolean
): CandidatePlace[] {
  const lowerInterests = interests.map((i) => i.toLowerCase());
  const byCostIfNeeded = (list: CandidatePlace[]) =>
    preferCheaper ? [...list].sort((a, b) => a.estimatedCost - b.estimatedCost) : list;

  if (interests.length === 0) return byCostIfNeeded(candidates);

  const matching = candidates.filter((c) => lowerInterests.includes(c.category));
  const rest = candidates.filter((c) => !lowerInterests.includes(c.category));
  return [...byCostIfNeeded(matching), ...byCostIfNeeded(rest)];
}

export function generateItinerary(context: TripContext): ItineraryPlan {
  const durationDays = context.durationDays ?? 1;
  const travelers = context.travelers ?? 1;
  const destination = context.destination ?? "your destination";
  const totalSlots = durationDays * MAX_ACTIVITIES_PER_DAY;

  const allCandidates = getCandidatePlaces(destination);
  // A tight per-activity budget share biases activity picks cheaper —
  // "under ₹20,000 for 3 people" should skew toward free/low-cost sights,
  // not the same mix a luxury trip would get.
  const perActivityBudgetShare = context.budget ? context.budget / totalSlots : null;
  const averageCandidateCost =
    allCandidates.reduce((sum, c) => sum + c.estimatedCost, 0) / allCandidates.length;
  const preferCheaper =
    perActivityBudgetShare !== null && perActivityBudgetShare < averageCandidateCost;

  const candidates = prioritizeByInterests(allCandidates, context.interests ?? [], preferCheaper);

  const days: PlannedDay[] = [];
  let candidateIndex = 0;
  let totalEstimatedCost = 0;

  for (let dayNumber = 1; dayNumber <= durationDays; dayNumber++) {
    const activities: PlannedActivity[] = [];

    for (let slot = 0; slot < MAX_ACTIVITIES_PER_DAY; slot++) {
      // Once every curated place has appeared once, don't repeat named
      // landmarks verbatim (visiting "Fort Aguada" twice reads as a bug,
      // not a plan) — fill remaining slots with unstructured leisure time
      // instead of cycling back through the list.
      if (candidateIndex >= candidates.length) {
        activities.push({
          name: "Free time to relax or revisit a favorite spot",
          location: destination,
          startTime: TIME_SLOTS[slot].start,
          endTime: TIME_SLOTS[slot].end,
          estimatedCost: 0,
          notes: null,
        });
        continue;
      }

      const candidate = candidates[candidateIndex];
      candidateIndex++;
      if (!candidate) break;

      const cost = candidate.estimatedCost * travelers;
      totalEstimatedCost += cost;

      activities.push({
        name: candidate.name,
        location: candidate.location ?? destination,
        startTime: TIME_SLOTS[slot].start,
        endTime: TIME_SLOTS[slot].end,
        estimatedCost: cost,
        notes: null,
      });
    }

    // Validation: never produce an empty day, even if there were no
    // candidates at all (shouldn't happen — destinations.ts always returns
    // a generic fallback list — but this is the pipeline's safety net).
    if (activities.length === 0) {
      activities.push({
        name: `Free day to explore ${destination}`,
        location: destination,
        startTime: TIME_SLOTS[0].start,
        endTime: TIME_SLOTS[TIME_SLOTS.length - 1].end,
        estimatedCost: 0,
        notes: null,
      });
    }

    days.push({
      dayNumber,
      title: `${destination} — Day ${dayNumber}`,
      activities,
    });
  }

  const warnings: string[] = [];
  if (context.budget && totalEstimatedCost > context.budget) {
    warnings.push(
      `Estimated activity cost (${totalEstimatedCost}) exceeds the stated budget (${context.budget}). ` +
        `This doesn't include transport, accommodation or food — see the Budget Engine for a full breakdown.`
    );
  }

  return { days, totalEstimatedCost, warnings };
}
