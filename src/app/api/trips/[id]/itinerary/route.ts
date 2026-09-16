import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { generateItinerary } from "@/lib/planner/itinerary-engine";
import { TripStatus } from "@/generated/prisma/client";

async function getOwnedTrip(userId: string, tripId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId } });
}

// Generates (or regenerates) the itinerary for a trip from its stored
// fields via the deterministic planning pipeline (Section 15.1). This
// replaces any existing itinerary/activities for the trip.
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

  const plan = generateItinerary({
    destination: trip.destination,
    durationDays: trip.durationDays,
    travelers: trip.travelers,
    budget: Number(trip.budget),
    interests: [],
  });

  await prisma.$transaction([
    prisma.itinerary.deleteMany({ where: { tripId: trip.id } }),
    ...plan.days.map((day) =>
      prisma.itinerary.create({
        data: {
          tripId: trip.id,
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
    prisma.trip.update({ where: { id: trip.id }, data: { status: TripStatus.PLANNED } }),
  ]);

  const itineraries = await prisma.itinerary.findMany({
    where: { tripId: trip.id },
    orderBy: { dayNumber: "asc" },
    include: { activities: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ itineraries, totalEstimatedCost: plan.totalEstimatedCost, warnings: plan.warnings });
}

const activityInput = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().nullable().optional(),
  startTime: z.string().trim().nullable().optional(),
  endTime: z.string().trim().nullable().optional(),
  estimatedCost: z.number().nonnegative().default(0),
  notes: z.string().trim().nullable().optional(),
});

const dayInput = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().trim().min(1),
  activities: z.array(activityInput),
});

const updateItinerarySchema = z.object({
  days: z.array(dayInput).min(1),
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

  const itineraries = await prisma.itinerary.findMany({
    where: { tripId: trip.id },
    orderBy: { dayNumber: "asc" },
    include: { activities: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ itineraries });
}
