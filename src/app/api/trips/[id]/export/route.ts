import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { limitUser } from "@/lib/security/api-limit";
import { buildTripExport } from "@/lib/export/trip-export";

// Everything the offline PDF needs, for the trip's owner only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = limitUser(session.user.id, "trip-export", 20);
  if (limited) return limited;

  const { id } = await params;
  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: {
      itineraries: {
        orderBy: { dayNumber: "asc" },
        include: { activities: { orderBy: { sortOrder: "asc" } } },
      },
      expenses: true,
      spendEntries: { orderBy: { spentAt: "asc" } },
    },
  });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ trip: buildTripExport(trip) }, { headers: { "Cache-Control": "no-store" } });
}
