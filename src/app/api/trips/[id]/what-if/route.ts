import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { scenarioSchema, simulateScenario, type TripSnapshot } from "@/lib/planner/what-if";
import { generateItineraryForTrip } from "@/lib/planner/trip-service";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";
import { getPersonalizationSignal } from "@/lib/recommendations/personalization";
import { checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  scenario: scenarioSchema,
  apply: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const limit = checkRateLimit(`whatif:${userId}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitResponseHeaders(limit) }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { scenario, apply } = parsed.data;
  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, userId },
    include: {
      itineraries: {
        orderBy: { dayNumber: "asc" },
        include: { activities: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshot: TripSnapshot = {
    destination: trip.destination,
    durationDays: trip.durationDays,
    travelers: trip.travelers,
    budget: Number(trip.budget),
    days: trip.itineraries.map((day) => ({
      dayNumber: day.dayNumber,
      activities: day.activities.map((a) => ({
        id: a.id,
        name: a.name,
        location: a.location,
        startTime: a.startTime,
        endTime: a.endTime,
        estimatedCost: Number(a.estimatedCost),
        notes: a.notes,
      })),
    })),
  };

  const { interests } = await getPersonalizationSignal(userId);
  const result = simulateScenario(snapshot, scenario, interests);

  if (!apply) {
    return NextResponse.json({ result });
  }

  const nothingToApply =
    (scenario.type === "rain" && result.rainSwaps.length === 0) ||
    (scenario.type === "days" && result.after.durationDays === trip.durationDays);
  if (nothingToApply) {
    return NextResponse.json({ error: result.note ?? "Nothing to apply." }, { status: 400 });
  }

  if (scenario.type === "rain") {
    await prisma.$transaction(
      result.rainSwaps.map((swap) =>
        prisma.activity.update({
          where: { id: swap.activityId },
          data: {
            name: swap.replaceWith.name,
            location: swap.replaceWith.location,
            estimatedCost: swap.replaceWith.estimatedCost,
            notes: swap.replaceWith.notes,
          },
        })
      )
    );
    await recalculateTripBudget(trip.id);
  } else {
    await prisma.trip.update({
      where: { id: trip.id },
      data:
        scenario.type === "budget"
          ? { budget: result.after.budget }
          : { durationDays: result.after.durationDays },
    });
    await generateItineraryForTrip(trip.id);
  }

  return NextResponse.json({ applied: true });
}
