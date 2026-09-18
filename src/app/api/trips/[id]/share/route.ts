import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { generateShareToken } from "@/lib/security/share-token";
import { Prisma } from "@/generated/prisma/client";

async function getOwnedTrip(userId: string, tripId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId } });
}

// Idempotent: turning sharing on twice returns the same link rather than
// rotating it, so a link someone already copied and sent doesn't silently
// break.
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

  if (trip.shareToken) {
    return NextResponse.json({ shareToken: trip.shareToken });
  }

  // A base64url collision across two trips is astronomically unlikely
  // (192 bits of randomness) — retried rather than trusted blindly only
  // because the column has a real unique constraint, and failing outright
  // on a one-in-billions collision would be a needlessly bad experience.
  for (let attempt = 0; attempt < 3; attempt++) {
    const shareToken = generateShareToken();
    try {
      const updated = await prisma.trip.update({
        where: { id: trip.id },
        data: { shareToken },
      });
      return NextResponse.json({ shareToken: updated.shareToken });
    } catch (err) {
      const isCollision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isCollision || attempt === 2) throw err;
    }
  }
}

export async function DELETE(
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

  await prisma.trip.update({
    where: { id: trip.id },
    data: { shareToken: null },
  });

  return NextResponse.json({ success: true });
}
