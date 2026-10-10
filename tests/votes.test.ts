import { describe, expect, it } from "vitest";
import { tallyVotes, verdictFor, votedDownIds, voteBodySchema } from "@/lib/voting/votes";

describe("tallyVotes / verdictFor", () => {
  it("counts up and down votes per activity", () => {
    const t = tallyVotes([
      { activityId: "a", value: 1 },
      { activityId: "a", value: 1 },
      { activityId: "a", value: -1 },
      { activityId: "b", value: -1 },
    ]);
    expect(t.a).toEqual({ up: 2, down: 1 });
    expect(t.b).toEqual({ up: 0, down: 1 });
  });

  it("gives the right verdicts", () => {
    expect(verdictFor(undefined)).toBe("no-votes");
    expect(verdictFor({ up: 0, down: 0 })).toBe("no-votes");
    expect(verdictFor({ up: 3, down: 1 })).toBe("favourite");
    expect(verdictFor({ up: 1, down: 2 })).toBe("voted-down");
    expect(verdictFor({ up: 2, down: 2 })).toBe("mixed");
  });

  it("only flags activities with strictly more downs than ups as voted down", () => {
    const tallies = { a: { up: 1, down: 2 }, b: { up: 2, down: 2 }, c: { up: 0, down: 0 } };
    expect(votedDownIds([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], tallies)).toEqual(["a"]);
  });
});

describe("voteBodySchema", () => {
  const ok = { activityId: "abc", value: 1, voterKey: "a".repeat(32), voterName: "Priya" };

  it("accepts a valid vote and a withdrawal", () => {
    expect(voteBodySchema.safeParse(ok).success).toBe(true);
    expect(voteBodySchema.safeParse({ ...ok, value: 0 }).success).toBe(true);
  });

  it("rejects bad values, short keys, and markup in names", () => {
    expect(voteBodySchema.safeParse({ ...ok, value: 5 }).success).toBe(false);
    expect(voteBodySchema.safeParse({ ...ok, voterKey: "short" }).success).toBe(false);
    expect(voteBodySchema.safeParse({ ...ok, voterKey: "bad key with spaces!!!!!!" }).success).toBe(false);
    expect(voteBodySchema.safeParse({ ...ok, voterName: "<script>" }).success).toBe(false);
    expect(voteBodySchema.safeParse({ ...ok, voterName: "   " }).success).toBe(false);
    expect(voteBodySchema.safeParse({ ...ok, voterName: "x".repeat(41) }).success).toBe(false);
  });
});
