import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getCandidatePlaces } from "@/lib/planner/destinations";

// Stubbed against the curated candidate-place dataset (see
// lib/planner/destinations.ts) until a real places provider is wired in
// (Phase 8).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const destination = searchParams.get("destination")?.trim();
  const category = searchParams.get("category")?.trim().toLowerCase();

  if (!destination) {
    return NextResponse.json({ error: "destination query param is required" }, { status: 400 });
  }

  let places = getCandidatePlaces(destination);
  if (category) {
    places = places.filter((p) => p.category === category);
  }

  return NextResponse.json({ places });
}
