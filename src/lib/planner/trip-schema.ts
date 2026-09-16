import { z } from "zod";

export const createTripSchema = z.object({
  // Either provide the trip fields directly, or point at a chat session
  // whose extracted TripContext (Phase 4) already has them.
  fromSessionId: z.string().optional(),
  destination: z.string().trim().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  travelers: z.number().int().positive().optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
});

export const updateTripSchema = z.object({
  destination: z.string().trim().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  travelers: z.number().int().positive().optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
});
