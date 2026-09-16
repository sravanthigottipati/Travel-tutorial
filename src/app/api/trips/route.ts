import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { createTripSchema } from "@/lib/planner/trip-schema";
import { createTrip } from "@/lib/planner/trip-service";
import { parseStoredTripContext } from "@/lib/ai/trip-context";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;

  let fields = {
    destination: input.destination,
    durationDays: input.durationDays,
    travelers: input.travelers,
    budget: input.budget,
  };
  let chatSessionId: string | null = null;

  if (input.fromSessionId) {
    const chatSession = await prisma.chatSession.findFirst({
      where: { id: input.fromSessionId, userId },
    });
    if (!chatSession) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    const context = parseStoredTripContext(chatSession.context);
    fields = {
      destination: context.destination,
      durationDays: context.durationDays,
      travelers: context.travelers,
      budget: context.budget,
    };
    chatSessionId = chatSession.id;
  }

  if (!fields.destination || !fields.durationDays || !fields.travelers || !fields.budget) {
    return NextResponse.json(
      {
        error:
          "Missing required trip fields (destination, durationDays, travelers, budget)",
      },
      { status: 400 }
    );
  }

  const trip = await createTrip(
    userId,
    {
      destination: fields.destination,
      durationDays: fields.durationDays,
      travelers: fields.travelers,
      budget: fields.budget,
    },
    input.startDate ? new Date(input.startDate) : undefined
  );

  if (chatSessionId) {
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { tripId: trip.id },
    });
  }

  return NextResponse.json({ trip }, { status: 201 });
}
