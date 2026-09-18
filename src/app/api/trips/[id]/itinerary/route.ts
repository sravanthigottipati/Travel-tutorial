import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { generateItineraryForTrip } from "@/lib/planner/trip-service";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";

async function getOwnedTrip(userId: string, tripId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId } });
}

// Generates (or regenerates) the itinerary for a trip from its stored
// fields via the deterministic planning pipeline (Section 15.1). This
// replaces any existing itinerary/activities for the trip. Shared with the
// Phase 9 generateItinerary tool via generateItineraryForTrip().
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const trip = await getOwnedTrip(session.user.id, id);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await generateItineraryForTrip(trip.id);

  return NextResponse.json(result);
}

// Bounds mirror the AI tool-calling path's modifyItinerary args (tools.ts)
// — this is the other route that can write the same Itinerary/Activity
// rows, so it needs the same ceiling. Found in a VAPT re-check: this
// endpoint had no array-length or string-length limits at all, so an
// authenticated user could PUT a single request with, say, 50,000 days of
// 50,000 activities each — a resource-exhaustion DoS via the $transaction
// below, not a hypothetical: durationDays/travelers/budget already got
// this treatment for exactly this class of issue (see trip-schema.ts).
const activityInput = z.object({
  name: z.string().trim().min(1).max(60),
  location: z.string().trim().max(120).nullable().optional(),
  startTime: z.string().trim().max(20).nullable().optional(),
  endTime: z.string().trim().max(20).nullable().optional(),
  estimatedCost: z.number().nonnegative().max(100_000_000).default(0),
  notes: z.string().trim().max(300).nullable().optional(),
});

const dayInput = z.object({
  dayNumber: z.number().int().positive().max(60),
  title: z.string().trim().min(1).max(100),
  activities: z.array(activityInput).max(30),
});

const updateItinerarySchema = z.object({
  days: z.array(dayInput).min(1).max(60),
});

// Manual edit: replaces the itinerary with a caller-supplied day/activity
// list (e.g. from an itinerary-editing UI). AI-driven conversational edits
// ("remove the Day 2 beach visit") are a Phase 9 tool-calling concern —
// this is the underlying primitive they'll eventually call.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const trip = await getOwnedTrip(session.user.id, id);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateItinerarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.itinerary.deleteMany({ where: { tripId: trip.id } }),
    ...parsed.data.days.map((day) =>
      prisma.itinerary.create({
        data: {
          tripId: trip.id,
          dayNumber: day.dayNumber,
          title: day.title,
          activities: {
            create: day.activities.map((activity, index) => ({
              name: activity.name,
              location: activity.location ?? null,
              startTime: activity.startTime ?? null,
              endTime: activity.endTime ?? null,
              estimatedCost: activity.estimatedCost,
              notes: activity.notes ?? null,
              sortOrder: index,
            })),
          },
        },
      })
    ),
  ]);

  const [itineraries, budget] = await Promise.all([
    prisma.itinerary.findMany({
      where: { tripId: trip.id },
      orderBy: { dayNumber: "asc" },
      include: { activities: { orderBy: { sortOrder: "asc" } } },
    }),
    recalculateTripBudget(trip.id),
  ]);

  return NextResponse.json({ itineraries, budget });
}
