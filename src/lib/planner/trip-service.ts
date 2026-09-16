import { prisma } from "@/lib/db/prisma";
import { generateItinerary } from "@/lib/planner/itinerary-engine";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";
import { TripStatus } from "@/generated/prisma/client";
import type { TripContext } from "@/lib/ai/trip-context";

// Shared by the /api/trips route and the Phase 9 tool layer (createTrip) —
// one place that actually writes a Trip row, so both the manual "New trip"
// form/API and the AI orchestrator's tool call produce identical results.
export async function createTrip(
  userId: string,
  fields: Required<Pick<TripContext, "destination" | "durationDays" | "travelers" | "budget">>,
  startDate?: Date
) {
  return prisma.trip.create({
    data: {
      userId,
      destination: fields.destination,
      durationDays: fields.durationDays,
      travelers: fields.travelers,
      budget: fields.budget,
      startDate,
    },
  });
}

// Shared by POST /api/trips/:id/itinerary and the Phase 9 generateItinerary
// tool. Runs the Section 15.1 planning pipeline, persists it, and
// recalculates the budget to match (Phase 6) — the itinerary and budget
// must never go out of sync with each other.
export async function generateItineraryForTrip(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });

  const plan = generateItinerary({
    destination: trip.destination,
    durationDays: trip.durationDays,
    travelers: trip.travelers,
    budget: Number(trip.budget),
    interests: [],
  });

  await prisma.$transaction([
    prisma.itinerary.deleteMany({ where: { tripId } }),
    ...plan.days.map((day) =>
      prisma.itinerary.create({
        data: {
          tripId,
          dayNumber: day.dayNumber,
          title: day.title,
          activities: {
            create: day.activities.map((activity, index) => ({
              name: activity.name,
              location: activity.location,
              startTime: activity.startTime,
              endTime: activity.endTime,
              estimatedCost: activity.estimatedCost,
              notes: activity.notes,
              sortOrder: index,
            })),
          },
        },
      })
    ),
    prisma.trip.update({ where: { id: tripId }, data: { status: TripStatus.PLANNED } }),
  ]);

  const [itineraries, budget] = await Promise.all([
    prisma.itinerary.findMany({
      where: { tripId },
      orderBy: { dayNumber: "asc" },
      include: { activities: { orderBy: { sortOrder: "asc" } } },
    }),
    recalculateTripBudget(tripId),
  ]);

  return { itineraries, budget, warnings: plan.warnings };
}
