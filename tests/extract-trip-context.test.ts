import { describe, expect, it } from "vitest";
import { extractTripUpdate } from "@/lib/ai/extract-trip-context";
import { emptyTripContext } from "@/lib/ai/trip-context";

// GROQ_API_KEY is unset in the test environment, so extractTripUpdate()
// exercises the heuristic stub path — see src/lib/ai/extract-trip-context.ts.

describe("extractTripUpdate (heuristic stub)", () => {
  it("extracts destination, duration, travelers, budget and interests from a full request", async () => {
    const { intent, update } = await extractTripUpdate(
      "Plan a 4-day Goa trip for three people under ₹20,000. We like beaches and photography.",
      emptyTripContext
    );

    expect(intent).toBe("create_trip");
    expect(update.destination).toBe("Goa");
    expect(update.durationDays).toBe(4);
    expect(update.travelers).toBe(3);
    expect(update.budget).toBe(20000);
    expect(update.interests).toEqual(expect.arrayContaining(["beaches", "photography"]));
  });

  it("detects a modification when trip context already exists", async () => {
    const existing = { destination: "Goa", durationDays: 4, travelers: 3, interests: [] };
    const { intent, update } = await extractTripUpdate(
      "We are staying for five days now.",
      existing
    );

    expect(intent).toBe("modify_trip");
    expect(update.durationDays).toBe(5);
  });

  it("classifies cost complaints as budget intent", async () => {
    const { intent } = await extractTripUpdate(
      "That's too expensive, can you make it cheaper?",
      emptyTripContext
    );
    expect(intent).toBe("budget");
  });

  it("classifies vague chat as chitchat with no update", async () => {
    const { intent, update } = await extractTripUpdate("Hey, how are you?", emptyTripContext);
    expect(intent).toBe("chitchat");
    expect(update).toEqual({});
  });

  it("recognizes dietary preference", async () => {
    const { update } = await extractTripUpdate(
      "I'm vegetarian, please keep that in mind.",
      emptyTripContext
    );
    expect(update.foodPreference).toBe("vegetarian");
  });
});
