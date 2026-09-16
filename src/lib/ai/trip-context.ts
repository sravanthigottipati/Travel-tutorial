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
