import {
  getCandidatePlaces,
  CURATED_DESTINATIONS,
  type CandidatePlace,
} from "@/lib/planner/destinations";

// Rules-and-filtering recommendation engine (Section 17): matches user
// requirements — interests, budget — against destination/place attributes.
// Embeddings/semantic retrieval remain deliberately unimplemented — see
// personalization.ts for why. Phase 10's other half, historical trips and
// stored preferences, is wired in via the `exclude` param and by callers
// (chat route, tools.ts) merging in the user's profile interests.

export type DestinationRecommendation = {
  destination: string;
  score: number;
  matchedInterests: string[];
  reason: string;
};

export type PlaceRecommendation = CandidatePlace & {
  score: number;
  matchedInterest: boolean;
};

function normalize(interests: string[]): string[] {
  return interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
}

// Ranks known destinations by how many of the traveler's interests their
// curated places cover. Only considers destinations with real curated data
// (CURATED_DESTINATIONS) — a recommendation should come with a reason, not
// a guess about a destination we know nothing about. `exclude` (typically
// the user's already-visited destinations — Phase 10 personalization)
// drops those from consideration entirely, rather than just ranking them
// lower, so a returning user isn't repeatedly pointed back to trips
// they've already taken.
export function recommendDestinations(
  interests: string[],
  limit = 5,
  exclude: string[] = []
): DestinationRecommendation[] {
  const wanted = normalize(interests);
  const excluded = new Set(normalize(exclude));

  const scored = CURATED_DESTINATIONS.filter((d) => !excluded.has(d)).map((destination) => {
    const places = getCandidatePlaces(destination);
    const categoriesOffered = new Set(places.map((p) => p.category));
    const matchedInterests = wanted.filter((i) => categoriesOffered.has(i as CandidatePlace["category"]));

    const label = destination[0].toUpperCase() + destination.slice(1);
    const reason =
      matchedInterests.length > 0
        ? `Has ${matchedInterests.join(", ")}`
        : `General destination with ${places.length} curated activities`;

    return {
      destination: label,
      score: matchedInterests.length,
      matchedInterests,
      reason,
    };
  });

  // With no stated interests, nothing has a positive score — surface all
  // curated destinations anyway rather than an empty list.
  const ranked = wanted.length === 0 ? scored : scored.filter((s) => s.score > 0);

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Ranks a destination's candidate places by interest match, with cost as a
// tiebreaker (cheaper first) — a simple, explainable relevance score
// rather than a black-box one.
export function recommendPlaces(
  destination: string,
  interests: string[],
  limit = 6
): PlaceRecommendation[] {
  const wanted = new Set(normalize(interests));

  const scored = getCandidatePlaces(destination).map((place) => {
    const matchedInterest = wanted.has(place.category);
    return { ...place, score: matchedInterest ? 1 : 0, matchedInterest };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.estimatedCost - b.estimatedCost)
    .slice(0, limit);
}
