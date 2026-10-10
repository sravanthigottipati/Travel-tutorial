import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner/itinerary-engine";
import { getCrowdLevel } from "@/lib/planner/crowd-levels";

const base = { destination: "goa", durationDays: 3, travelers: 2, interests: [] as string[] };

describe("hidden gems itinerary", () => {
  it("classifies iconic spots as busy, off-trail spots as quiet, the rest as moderate", () => {
    expect(getCrowdLevel("Baga Beach")).toBe("high");
    expect(getCrowdLevel("Divar Island cycling")).toBe("low");
    expect(getCrowdLevel("Spice plantation tour")).toBe("medium");
  });

  it("puts quieter places before busy ones and tags each with a crowd note", () => {
    const plan = generateItinerary({ ...base, hiddenGems: true });
    const names = plan.days.flatMap((d) => d.activities.map((a) => a.name));
    expect(names.indexOf("Divar Island cycling")).toBeLessThan(names.indexOf("Baga Beach"));
    const firstActivity = plan.days[0].activities[0];
    expect(firstActivity.notes).toMatch(/^Typical crowd: (Quiet|Moderate|Busy) \(estimate\)$/);
  });

  it("leaves the normal ordering and notes untouched when the mode is off", () => {
    const plan = generateItinerary(base);
    expect(plan.days[0].activities[0].name).toBe("Baga Beach");
    expect(plan.days[0].activities.every((a) => a.notes === null)).toBe(true);
  });
});
