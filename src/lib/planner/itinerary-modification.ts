import { prisma } from "@/lib/db/prisma";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";

export type ModifiableActivity = { id: string; name: string };

// Pure — "identify the affected itinerary item" from Section 27.3
// (conversational modification). Case-insensitive substring match; when
// several activities match, prefers the shortest name (the most specific
// match) rather than picking arbitrarily.
export function findActivityMatch<T extends ModifiableActivity>(
  activities: T[],
  nameContains: string
): T | null {
  const needle = nameContains.trim().toLowerCase();
  if (!needle) return null;

  const matches = activities.filter((a) => a.name.toLowerCase().includes(needle));
  if (matches.length === 0) return null;

  return matches.reduce((best, current) =>
    current.name.length < best.name.length ? current : best
  );
}

export class ItineraryModificationError extends Error {}

// Removes the itinerary activity on `dayNumber` whose name contains
// `nameContains`, then recalculates the budget so it never drifts from the
// itinerary it's derived from (Phase 6). Table 18's "Remove Day 2 beach."
// scenario, implemented as a deterministic backend mutation rather than
// free-form AI text editing the plan directly.
export async function removeActivity(
  tripId: string,
  dayNumber: number,
  nameContains: string
) {
  const day = await prisma.itinerary.findUnique({
    where: { tripId_dayNumber: { tripId, dayNumber } },
    include: { activities: true },
  });
  if (!day) {
    throw new ItineraryModificationError(`Trip has no Day ${dayNumber}.`);
  }

  const match = findActivityMatch(day.activities, nameContains);
  if (!match) {
    throw new ItineraryModificationError(
      `No activity matching "${nameContains}" found on Day ${dayNumber}.`
    );
  }

  await prisma.activity.delete({ where: { id: match.id } });
  const budget = await recalculateTripBudget(tripId);

  return { removed: match, budget };
}

// Adds a new activity to an existing itinerary day.
export async function addActivity(
  tripId: string,
  dayNumber: number,
  activity: {
    name: string;
    location?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    estimatedCost?: number;
    notes?: string | null;
  }
) {
  const day = await prisma.itinerary.findUnique({
    where: { tripId_dayNumber: { tripId, dayNumber } },
    include: { activities: true },
  });
  if (!day) {
    throw new ItineraryModificationError(`Trip has no Day ${dayNumber}.`);
  }

  const created = await prisma.activity.create({
    data: {
      itineraryId: day.id,
      name: activity.name,
      location: activity.location ?? null,
      startTime: activity.startTime ?? null,
      endTime: activity.endTime ?? null,
      estimatedCost: activity.estimatedCost ?? 0,
      notes: activity.notes ?? null,
      sortOrder: day.activities.length,
    },
  });
  const budget = await recalculateTripBudget(tripId);

  return { added: created, budget };
}
