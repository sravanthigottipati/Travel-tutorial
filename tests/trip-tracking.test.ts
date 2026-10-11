import { describe, expect, it } from "vitest";
import {
  activityStatusSchema,
  directionsUrl,
  distanceKm,
  spendEntrySchema,
  summarizeProgress,
  summarizeSpending,
} from "@/lib/planner/trip-tracking";

describe("summarizeProgress", () => {
  it("counts done and skipped as progress", () => {
    const p = summarizeProgress([{ status: "DONE" }, { status: "SKIPPED" }, { status: "PLANNED" }, { status: "PLANNED" }]);
    expect(p).toEqual({ done: 1, skipped: 1, planned: 2, total: 4, percent: 50 });
  });

  it("handles an empty day", () => {
    expect(summarizeProgress([]).percent).toBe(0);
  });
});

describe("summarizeSpending", () => {
  it("totals by category and against the budget", () => {
    const s = summarizeSpending(
      [
        { amount: 250.5, category: "FOOD" },
        { amount: 120, category: "LOCAL_TRANSPORT" },
        { amount: 79.5, category: "FOOD" },
      ],
      1000
    );
    expect(s.total).toBe(450);
    expect(s.remaining).toBe(550);
    expect(s.percentOfBudget).toBe(45);
    expect(s.byCategory).toEqual({ FOOD: 330, LOCAL_TRANSPORT: 120 });
  });

  it("goes negative when overspent", () => {
    expect(summarizeSpending([{ amount: 1200, category: "FOOD" }], 1000).remaining).toBe(-200);
  });
});

describe("spendEntrySchema", () => {
  it("accepts a normal entry and rejects bad amounts, categories and long notes", () => {
    expect(spendEntrySchema.safeParse({ amount: 150.25, category: "FOOD", note: "Lunch" }).success).toBe(true);
    expect(spendEntrySchema.safeParse({ amount: 0, category: "FOOD" }).success).toBe(false);
    expect(spendEntrySchema.safeParse({ amount: -5, category: "FOOD" }).success).toBe(false);
    expect(spendEntrySchema.safeParse({ amount: 1.234, category: "FOOD" }).success).toBe(false);
    expect(spendEntrySchema.safeParse({ amount: 1e9, category: "FOOD" }).success).toBe(false);
    expect(spendEntrySchema.safeParse({ amount: 10, category: "BRIBES" }).success).toBe(false);
    expect(spendEntrySchema.safeParse({ amount: 10, category: "FOOD", note: "x".repeat(121) }).success).toBe(false);
  });
});

describe("activityStatusSchema", () => {
  it("only allows the three statuses", () => {
    expect(activityStatusSchema.safeParse({ status: "DONE" }).success).toBe(true);
    expect(activityStatusSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });
});

describe("distanceKm / directionsUrl", () => {
  it("measures a known distance roughly right (Panaji to Mumbai ~ 440 km)", () => {
    const km = distanceKm({ lat: 15.4909, lon: 73.8278 }, { lat: 19.076, lon: 72.8777 });
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(480);
    expect(distanceKm({ lat: 1, lon: 1 }, { lat: 1, lon: 1 })).toBe(0);
  });

  it("encodes the place into a Google Maps directions link", () => {
    expect(directionsUrl("Fort Aguada, Goa")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Fort%20Aguada%2C%20Goa"
    );
  });
});
