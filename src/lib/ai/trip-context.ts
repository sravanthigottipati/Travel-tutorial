import { z } from "zod";

// Structured trip context the AI orchestrator extracts from conversation
// and the backend uses as the deterministic system-of-record for planning.
// See project documentary, Section 14 (Conversation and Memory Design).
export const tripContextSchema = z.object({
  destination: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  travelers: z.number().int().positive().optional(),
  budget: z.number().positive().optional(),
  interests: z.array(z.string()).default([]),
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

// Merges a partial update (typically AI-extracted from the latest message)
// into the existing trip context. Scalars are overwritten when present;
// interests are unioned so earlier-stated interests aren't lost.
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
    interests: Array.from(mergedInterests),
  };
}
