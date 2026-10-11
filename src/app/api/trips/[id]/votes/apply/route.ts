import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { tallyVotes, votedDownIds } from "@/lib/voting/votes";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";
import { limitUser } from "@/lib/security/api-limit";

// Owner-only: removes every activity the group voted down (strictly more
// thumbs down than up). Votes on removed activities go with them (cascade).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = limitUser(session.user.id, "votes-apply", 20);
  if (limited) return limited;
  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: { itineraries: { include: { activities: { select: { id: true } } } }, votes: true },
  });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activities = trip.itineraries.flatMap((d) => d.activities);
  const removeIds = votedDownIds(activities, tallyVotes(trip.votes));
  if (removeIds.length === 0) {
    return NextResponse.json({ error: "No activities were voted down." }, { status: 400 });
  }

  await prisma.activity.deleteMany({ where: { id: { in: removeIds } } });
  await recalculateTripBudget(trip.id);
  return NextResponse.json({ removed: removeIds.length });
}
