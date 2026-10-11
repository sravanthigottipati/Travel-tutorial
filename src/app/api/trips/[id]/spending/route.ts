import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { limitUser } from "@/lib/security/api-limit";
import { MAX_SPEND_ENTRIES_PER_TRIP, spendEntrySchema } from "@/lib/planner/trip-tracking";

function toJson(entry: { id: string; amount: unknown; category: string; note: string | null; spentAt: Date }) {
  return {
    id: entry.id,
    amount: Number(entry.amount),
    category: entry.category,
    note: entry.note,
    spentAt: entry.spentAt.toISOString(),
  };
}

async function ownedTripId(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId }, select: { id: true } });
  return trip?.id ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const tripId = await ownedTripId(session.user.id, id);
  if (!tripId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.spendEntry.findMany({ where: { tripId }, orderBy: { spentAt: "desc" } });
  return NextResponse.json({ entries: entries.map(toJson) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = limitUser(session.user.id, "spending-add", 60);
  if (limited) return limited;

  const parsed = spendEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an amount and a category." }, { status: 400 });
  }

  const { id } = await params;
  const tripId = await ownedTripId(session.user.id, id);
  if (!tripId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((await prisma.spendEntry.count({ where: { tripId } })) >= MAX_SPEND_ENTRIES_PER_TRIP) {
    return NextResponse.json(
      { error: `This trip already has ${MAX_SPEND_ENTRIES_PER_TRIP} spending entries.` },
      { status: 409 }
    );
  }

  const entry = await prisma.spendEntry.create({
    data: {
      tripId,
      amount: parsed.data.amount,
      category: parsed.data.category,
      note: parsed.data.note || null,
    },
  });
  return NextResponse.json({ entry: toJson(entry) }, { status: 201 });
}
