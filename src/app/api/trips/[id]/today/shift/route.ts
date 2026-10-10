import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { MAX_SHIFT_MINUTES, MIN_SHIFT_MINUTES, shiftFrom } from "@/lib/planner/today";
import { checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  dayNumber: z.number().int().min(1).max(60),
  fromActivityId: z.string().min(1).max(60),
  minutes: z.number().int().min(MIN_SHIFT_MINUTES).max(MAX_SHIFT_MINUTES),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const limit = checkRateLimit(`today-shift:${userId}`, 30, 60_000);
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
  const { dayNumber, fromActivityId, minutes } = parsed.data;
  const { id } = await params;

  const day = await prisma.itinerary.findFirst({
    where: { tripId: id, dayNumber, trip: { userId } },
    include: { activities: { orderBy: { sortOrder: "asc" } } },
  });
  if (!day || !day.activities.some((a) => a.id === fromActivityId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { activities, overflow } = shiftFrom(
    day.activities.map((a) => ({ id: a.id, name: a.name, startTime: a.startTime, endTime: a.endTime })),
    fromActivityId,
    minutes
  );

  await prisma.$transaction(
    activities.map((a) =>
      prisma.activity.update({ where: { id: a.id }, data: { startTime: a.startTime, endTime: a.endTime } })
    )
  );

  return NextResponse.json({ activities, overflow });
}
