import { z } from "zod";

// Structured trip context the AI orchestrator extracts from conversation
// and the backend uses as the deterministic system-of-record for planning.
// See project documentary, Section 14 (Conversation and Memory Design).
//
// Bounds mirror trip-schema.ts/tools.ts's createTrip validation — this is
// the actual value source createTrip's tool-call args get overridden with
// (see agent.ts), so an unbounded durationDays extracted here (e.g. a user
// typing "plan a 10 million day trip") would otherwise reach the same
// itinerary-generation resource-exhaustion path those bounds exist to close.
export const tripContextSchema = z.object({
  destination: z.string().min(1).max(100).optional(),
  durationDays: z.number().int().positive().max(60).optional(),
  travelers: z.number().int().positive().max(20).optional(),
  budget: z.number().positive().max(100_000_000).optional(),
  // Bound matches profile/route.ts's UserPreferences.interests cap — this
  // is the other place the same data can grow (AI-extracted from
  // conversation rather than the profile form), so it needs the same
  // ceiling to stop unbounded growth in the stored ChatSession.context JSON.
  interests: z.array(z.string().max(50)).max(20).default([]),
  foodPreference: z.string().optional(),
});

export type TripContext = z.infer<typeof tripContextSchema>;

export const emptyTripContext: TripContext = { interests: [] };

// Validates each field of an untrusted object independently against
// tripContextSchema, keeping only the fields that pass and silently
// dropping the rest. Deliberately field-by-field rather than one
// `tripContextSchema.partial().safeParse(value)` call: Zod fails an entire
// object parse if any single field is invalid, which would discard valid
// fields (e.g. a good `destination`) just because an unrelated field (e.g.
// a malformed `durationDays`) was bad — exactly the AI-generated JSON this
// exists to guard against.
export function safeParseTripContextFields(value: unknown): Partial<TripContext> {
  if (typeof value !== "object" || value === null) return {};

  const result: Partial<TripContext> = {};
  for (const key of Object.keys(tripContextSchema.shape) as (keyof TripContext)[]) {
    const fieldValue = (value as Record<string, unknown>)[key];
    if (fieldValue === undefined) continue;
    const fieldParsed = tripContextSchema.shape[key].safeParse(fieldValue);
    if (fieldParsed.success) {
      (result as Record<string, unknown>)[key] = fieldParsed.data;
    }
  }
  return result;
}

// Safely parses whatever is stored in ChatSession.context (JSON of unknown
// shape) back into a TripContext — the stored value round-trips through
// AI-generated JSON and must never be trusted as-is.
export function parseStoredTripContext(value: unknown): TripContext {
  const fields = safeParseTripContextFields(value);
  return { interests: [], ...fields };
}

// Cap on the FINAL merged interests list, not just one update's — each
// individual update is already capped by the schema (max 20), but a union
// across many conversation turns can still grow past that indefinitely
// (turn 1 gives 20 new interests, turn 2 gives 20 different ones, etc.).
// Found in a VAPT re-check: 20 keeps this in line with the same field's
// cap everywhere else it's set (profile/route.ts's UserPreferences).
const MAX_MERGED_INTERESTS = 20;

// Merges a partial update (typically AI-extracted from the latest message)
// into the existing trip context. Scalars are overwritten when present;
// interests are unioned (then re-capped) so earlier-stated interests
// aren't lost, but the list still can't grow without bound.
export function mergeTripContext(
  base: TripContext,
  update: Partial<TripContext>
): TripContext {
  const mergedInterests = new Set([
    ...(base.interests ?? []),
    ...(update.interests ?? []),
  ]);

  return {
    ...base,
    ...update,
    interests: Array.from(mergedInterests).slice(0, MAX_MERGED_INTERESTS),
  };
}
