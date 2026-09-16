import { describe, expect, it } from "vitest";
import { parseRemoveActivityCommand } from "@/lib/ai/agent";

describe("parseRemoveActivityCommand", () => {
  it("parses the Table 18 example: 'Remove Day 2 beach.'", () => {
    const result = parseRemoveActivityCommand("Remove Day 2 beach.");
    expect(result).toEqual({ nameContains: "beach", dayNumber: 2 });
  });

  it("parses 'remove the X on day N' phrasing", () => {
    const result = parseRemoveActivityCommand("Please remove the flea market on day 3");
    expect(result).toEqual({ nameContains: "flea market", dayNumber: 3 });
  });

  it("parses 'remove X from day N' phrasing", () => {
    const result = parseRemoveActivityCommand("remove fort aguada from day 1");
    expect(result).toEqual({ nameContains: "fort aguada", dayNumber: 1 });
  });

  it("returns null for messages without a remove command", () => {
    expect(parseRemoveActivityCommand("What's the weather like?")).toBeNull();
    expect(parseRemoveActivityCommand("Make it cheaper")).toBeNull();
  });
});
