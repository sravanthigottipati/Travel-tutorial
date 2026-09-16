import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getCandidatePlaces } from "@/lib/planner/destinations";
import { recommendPlaces } from "@/lib/recommendations/recommendation-engine";

// Stubbed against the curated candidate-place dataset (see
// lib/planner/destinations.ts) until a real places provider is wired in
// (Phase 8).
//
// `category` does an exact filter (Phase 5 behavior); `interests` (comma
// list) ranks by relevance instead (Section 17, Recommendation Engine) —
// the two can be combined.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const destination = searchParams.get("destination")?.trim();
  const category = searchParams.get("category")?.trim().toLowerCase();
  const interestsParam = searchParams.get("interests");

  if (!destination) {
    return NextResponse.json({ error: "destination query param is required" }, { status: 400 });
  }

  if (interestsParam) {
    const interests = interestsParam.split(",").map((i) => i.trim()).filter(Boolean);
    let places = recommendPlaces(destination, interests);
    if (category) places = places.filter((p) => p.category === category);
    return NextResponse.json({ places });
  }

  let places = getCandidatePlaces(destination);
  if (category) {
    places = places.filter((p) => p.category === category);
  }

  return NextResponse.json({ places });
}
