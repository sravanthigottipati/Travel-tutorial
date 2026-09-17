import { z } from "zod";

// Upper bounds are a security control, not just input hygiene: the
// itinerary engine loops `durationDays` times building Prisma `create`
// operations for a single `$transaction` array (see trip-service.ts /
// itinerary-engine.ts) with no cap of its own. Found in a VAPT review that
// nothing anywhere in the validation chain bounded these fields — a single
// authenticated request with e.g. durationDays: 10_000_000 would try to
// build millions of transaction operations synchronously, exhausting
// server memory/CPU and taking the single-instance app down for every
// user. 60 days / 20 travelers / ₹10 crore are generous ceilings for a
// real trip while closing that off.
const MAX_DURATION_DAYS = 60;
const MAX_TRAVELERS = 20;
const MAX_BUDGET = 100_000_000;

export const createTripSchema = z.object({
  // Either provide the trip fields directly, or point at a chat session
  // whose extracted TripContext (Phase 4) already has them.
  fromSessionId: z.string().optional(),
  destination: z.string().trim().min(1).max(100).optional(),
  durationDays: z.number().int().positive().max(MAX_DURATION_DAYS).optional(),
  travelers: z.number().int().positive().max(MAX_TRAVELERS).optional(),
  budget: z.number().positive().max(MAX_BUDGET).optional(),
  startDate: z.string().datetime().optional(),
});

export const updateTripSchema = z.object({
  destination: z.string().trim().min(1).max(100).optional(),
  durationDays: z.number().int().positive().max(MAX_DURATION_DAYS).optional(),
  travelers: z.number().int().positive().max(MAX_TRAVELERS).optional(),
  budget: z.number().positive().max(MAX_BUDGET).optional(),
  startDate: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
});
