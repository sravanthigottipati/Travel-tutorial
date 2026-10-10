import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp, checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";
import { MAX_VOTERS_PER_TRIP, tallyVotes, voteBodySchema } from "@/lib/voting/votes";

// Public on purpose: possessing the share token IS the authorization, the same
// as the /shared/[token] page. Everything a voter can write is a single
// bounded thumbs up/down row, so abuse is limited by per-IP rate limiting,
// a cap on distinct voters per trip, and the one-vote-per-activity constraint.
async function findSharedTrip(token: string) {
  return prisma.trip.findFirst({ where: { shareToken: token }, select: { id: true } });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limit = checkRateLimit(`votes-read:${getClientIp(request)}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitResponseHeaders(limit) });
  }

  const trip = await findSharedTrip(token);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voterKey = new URL(request.url).searchParams.get("voterKey") ?? "";
  const votes = await prisma.activityVote.findMany({
    where: { tripId: trip.id },
    select: { activityId: true, value: true, voterKey: true },
  });

  const mine: Record<string, number> = {};
  if (/^[A-Za-z0-9_-]{16,64}$/.test(voterKey)) {
    for (const v of votes) if (v.voterKey === voterKey) mine[v.activityId] = v.value;
  }
  return NextResponse.json({ tallies: tallyVotes(votes), mine });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limit = checkRateLimit(`votes-write:${getClientIp(request)}:${token.slice(0, 8)}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitResponseHeaders(limit) });
  }

  const parsed = voteBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  const { activityId, value, voterKey, voterName } = parsed.data;

  const trip = await findSharedTrip(token);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, itinerary: { tripId: trip.id } },
    select: { id: true },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (value === 0) {
    await prisma.activityVote.deleteMany({ where: { activityId, voterKey } });
  } else {
    const existing = await prisma.activityVote.findFirst({ where: { tripId: trip.id, voterKey }, select: { id: true } });
    if (!existing) {
      const voters = await prisma.activityVote.findMany({
        where: { tripId: trip.id },
        distinct: ["voterKey"],
        select: { voterKey: true },
      });
      if (voters.length >= MAX_VOTERS_PER_TRIP) {
        return NextResponse.json({ error: "This trip has reached its voter limit." }, { status: 409 });
      }
    }
    await prisma.activityVote.upsert({
      where: { activityId_voterKey: { activityId, voterKey } },
      update: { value, voterName },
      create: { tripId: trip.id, activityId, voterKey, voterName, value },
    });
  }

  const votes = await prisma.activityVote.findMany({
    where: { activityId },
    select: { activityId: true, value: true },
  });
  return NextResponse.json({ tally: tallyVotes(votes)[activityId] ?? { up: 0, down: 0 }, mine: value });
}
