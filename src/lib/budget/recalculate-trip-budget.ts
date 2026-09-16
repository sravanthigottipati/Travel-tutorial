import { prisma } from "@/lib/db/prisma";
import { buildBudgetSummary, type BudgetSummary } from "@/lib/budget/budget-engine";
import { ExpenseCategory } from "@/generated/prisma/client";

// Recomputes every expense category for a trip from scratch — deterministic
// non-activity estimates (rates.ts) plus the actual sum of the trip's
// itinerary activity costs — and replaces the trip's stored Expense rows
// with the result. Called after itinerary generation/edits, and directly
// via POST /api/budget/calculate. This is the one place Expense rows are
// written, so the trip's expense table is always reproducible from
// (durationDays, travelers, itinerary activities) rather than drifting.
export async function recalculateTripBudget(tripId: string): Promise<BudgetSummary> {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { itineraries: { include: { activities: true } } },
  });

  const activitiesCost = trip.itineraries
    .flatMap((day) => day.activities)
    .reduce((sum, activity) => sum + Number(activity.estimatedCost), 0);

  const summary = buildBudgetSummary(
    trip.durationDays,
    trip.travelers,
    activitiesCost,
    Number(trip.budget)
  );

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { tripId } }),
    ...(Object.entries(summary.breakdown) as [ExpenseCategory, number][]).map(
      ([category, amount]) =>
        prisma.expense.create({
          data: { tripId, category, amount },
        })
    ),
  ]);

  return summary;
}
