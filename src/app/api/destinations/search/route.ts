import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { KNOWN_DESTINATIONS } from "@/lib/planner/destinations";

// Stubbed against the curated destination list (see lib/planner/destinations.ts)
// until a real destinations/places provider is wired in (Phase 8).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  const matches = KNOWN_DESTINATIONS.filter((d) => d.includes(query)).map((d) => ({
    name: d[0].toUpperCase() + d.slice(1),
  }));

  return NextResponse.json({ destinations: matches });
}
