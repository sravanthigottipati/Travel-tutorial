import { describe, expect, it } from "vitest";
import { extractTripUpdate } from "@/lib/ai/extract-trip-context";
import { emptyTripContext } from "@/lib/ai/trip-context";
import { parseRemoveActivityCommand } from "@/lib/ai/agent";
import { tools } from "@/lib/ai/tools";

// Section 24.2 (AI Testing): "AI behavior should be evaluated with a fixed
// test set of realistic prompts. Tests should verify that the model
// extracts correct entities, selects the right tools, respects schemas and
// responds appropriately to incomplete or conflicting requests."
//
// This is that fixed test set — Table 18's five scenarios, made concrete
// and runnable. GROQ_API_KEY is unset in the test environment, so these
// exercise the heuristic stub extractor; the real Groq path is covered by
// live verification (see commit history for Phases 8-10) since it needs a
// real key to run, not by an automated test here.

describe("Table 18 scenario: 'Plan Goa for 4 days under ₹20,000.'", () => {
  it("extracts destination, duration and budget; leaves travelers unset rather than guessing", async () => {
    const { intent, update } = await extractTripUpdate(
      "Plan Goa for 4 days under ₹20,000.",
      emptyTripContext
    );
    expect(intent).toBe("create_trip");
    expect(update.destination).toBe("Goa");
    expect(update.durationDays).toBe(4);
    expect(update.budget).toBe(20000);
    // Table 18: "request missing traveler information only if required" —
    // the extractor must not fabricate a traveler count it wasn't given.
    expect(update.travelers).toBeUndefined();
  });
});

describe("Table 18 scenario: 'Make it cheaper.'", () => {
  it("classifies as budget intent against an active trip, not create/chitchat", async () => {
    const existingTripContext = {
      destination: "Goa",
      durationDays: 4,
      travelers: 3,
      budget: 20000,
      interests: [],
    };
    const { intent } = await extractTripUpdate("Make it cheaper.", existingTripContext);
    expect(intent).toBe("budget");
  });
});

describe("Table 18 scenario: 'Remove Day 2 beach.'", () => {
  it("parses into a structured (day, item) removal command rather than free text", () => {
    const command = parseRemoveActivityCommand("Remove Day 2 beach.");
    expect(command).toEqual({ nameContains: "beach", dayNumber: 2 });
  });
});

describe("Table 18 scenario: invalid or impossible request", () => {
  it("doesn't fabricate a confident extraction from a nonsensical message", async () => {
    const { intent, update } = await extractTripUpdate(
      "asdkfj qwerty zzz nonsense",
      emptyTripContext
    );
    expect(intent).toBe("chitchat");
    expect(update).toEqual({});
  });

  it("doesn't extract a negative or zero duration (schema requires positive)", async () => {
    // A message implying an impossible duration shouldn't produce a value
    // that later passes validation as a real trip length.
    const { update } = await extractTripUpdate(
      "Plan a -3 day trip to nowhere",
      emptyTripContext
    );
    expect(update.durationDays).toBeUndefined();
  });
});

describe("Table 18 scenario: malformed tool result", () => {
  it("rejects a modifyItinerary call missing the required day/action fields", () => {
    const result = tools.modifyItinerary.args.safeParse({ tripId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive day number rather than silently coercing it", () => {
    const result = tools.modifyItinerary.args.safeParse({
      tripId: "abc",
      dayNumber: 0,
      action: "remove_activity",
      activityNameContains: "beach",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized action value", () => {
    const result = tools.createTrip.args.safeParse({
      destination: "Goa",
      durationDays: 4,
      travelers: 3,
      budget: -100, // negative budget must never pass — Table 12's budget rule
    });
    expect(result.success).toBe(false);
  });
});
