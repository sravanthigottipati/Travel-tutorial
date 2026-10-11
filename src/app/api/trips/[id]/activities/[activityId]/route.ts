import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { limitUser } from "@/lib/security/api-limit";
import { activityStatusSchema } from "@/lib/planner/trip-tracking";

// Marks one activity done / skipped / planned during the trip.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const limited = limitUser(userId, "activity-status", 120);
  if (limited) return limited;

  const parsed = activityStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { id, activityId } = await params;
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, itinerary: { tripId: id, trip: { userId } } },
    select: { id: true },
  });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.activity.update({
    where: { id: activity.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });
  return NextResponse.json({ activity: updated });
}
