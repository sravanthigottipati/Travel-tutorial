import { describe, expect, it } from "vitest";
import { createTripSchema, updateTripSchema } from "@/lib/planner/trip-schema";

describe("createTripSchema", () => {
  it("accepts direct trip fields with no session", () => {
    const result = createTripSchema.safeParse({
      destination: "Goa",
      durationDays: 4,
      travelers: 3,
      budget: 20000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a bare fromSessionId with no other fields", () => {
    const result = createTripSchema.safeParse({ fromSessionId: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive duration/travelers/budget", () => {
    expect(createTripSchema.safeParse({ durationDays: 0 }).success).toBe(false);
    expect(createTripSchema.safeParse({ travelers: -1 }).success).toBe(false);
    expect(createTripSchema.safeParse({ budget: 0 }).success).toBe(false);
  });

  it("rejects a non-integer duration", () => {
    expect(createTripSchema.safeParse({ durationDays: 2.5 }).success).toBe(false);
  });

  it("rejects an empty destination string", () => {
    expect(createTripSchema.safeParse({ destination: "" }).success).toBe(false);
  });
});

describe("updateTripSchema", () => {
  it("accepts a partial update (single field)", () => {
    expect(updateTripSchema.safeParse({ status: "PLANNED" }).success).toBe(true);
    expect(updateTripSchema.safeParse({ budget: 5000 }).success).toBe(true);
  });

  it("rejects an unrecognized status", () => {
    expect(updateTripSchema.safeParse({ status: "ARCHIVED" }).success).toBe(false);
  });

  it("accepts a null startDate (clearing it)", () => {
    expect(updateTripSchema.safeParse({ startDate: null }).success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateTripSchema.safeParse({}).success).toBe(true);
  });
});
