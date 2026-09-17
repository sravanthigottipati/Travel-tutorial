import { prisma } from "@/lib/db/prisma";

// Section 17: "A later personalization layer can use historical saved trips
// and user preferences to improve recommendations."
//
// Deliberately NOT embeddings/pgvector, despite Phase 10 naming both: the
// docs frame that as "when semantic search becomes useful" (Section 8),
// which is a judgment call, not a mandate. With ~30 curated places across
// 4 destinations (Phase 5/7), there's no synonym/paraphrase problem for
// vector similarity to solve that the existing rules-based category
// matching doesn't already handle — semantic search earns its complexity
// against a large, unstructured catalog, not a small curated one. Adding
// pgvector now would mean wiring a real embeddings provider (another
// credential we don't have) to move numbers around that a keyword match
// already gets right. This *is* the "later, when justified" the docs
// describe — it isn't there yet.
export type PersonalizationSignal = {
  interests: string[];
  foodPreference: string | null;
  travelStyle: string | null;
  visitedDestinations: string[];
};

export async function getPersonalizationSignal(userId: string): Promise<PersonalizationSignal> {
  const [preferences, trips] = await Promise.all([
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.trip.findMany({
      where: { userId },
      select: { destination: true },
      distinct: ["destination"],
    }),
  ]);

  return {
    interests: preferences?.interests ?? [],
    foodPreference: preferences?.foodPreference ?? null,
    travelStyle: preferences?.travelStyle ?? null,
    visitedDestinations: trips.map((t) => t.destination),
  };
}
