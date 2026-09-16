import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { KNOWN_DESTINATIONS } from "@/lib/planner/destinations";
import { recommendDestinations } from "@/lib/recommendations/recommendation-engine";

// Stubbed against the curated destination list (see lib/planner/destinations.ts)
// until a real destinations/places provider is wired in (Phase 8).
//
// Two modes:
//  - `interests` given: ranked recommendations (Section 17, Recommendation
//    Engine) — destinations scored by how many stated interests they cover.
//  - `q` given (or neither): plain substring search, as in Phase 5.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const interestsParam = searchParams.get("interests");

  if (interestsParam) {
    const interests = interestsParam.split(",").map((i) => i.trim()).filter(Boolean);
    const destinations = recommendDestinations(interests);
    return NextResponse.json({ destinations });
  }

  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const matches = KNOWN_DESTINATIONS.filter((d) => d.includes(query)).map((d) => ({
    name: d[0].toUpperCase() + d.slice(1),
  }));

  return NextResponse.json({ destinations: matches });
}
