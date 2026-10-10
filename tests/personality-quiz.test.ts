import { describe, expect, it } from "vitest";
import { scoreQuiz, type QuizAnswers } from "@/lib/profile/personality-quiz";

const answers: QuizAnswers = {
  pace: "slow",
  spend: "budget",
  crowds: "avoid",
  interests: ["beaches", "photography"],
  food: "vegetarian",
};

describe("scoreQuiz", () => {
  it("derives a type name and a travel style string the AI prompt can use", () => {
    const result = scoreQuiz(answers);
    expect(result.typeName).toBe("Slow Wanderer");
    expect(result.travelStyle).toBe("Slow Wanderer — budget, slow pace, avoids crowds");
    expect(result.foodPreference).toBe("vegetarian");
  });

  it("keeps existing profile interests, puts quiz picks first, and stays within 20", () => {
    const existing = Array.from({ length: 25 }, (_, i) => `x${i}`);
    const result = scoreQuiz(answers, ["history", ...existing]);
    expect(result.interests.slice(0, 2)).toEqual(["beaches", "photography"]);
    expect(result.interests).toContain("history");
    expect(result.interests.length).toBe(20);
  });

  it("caps quiz interests at three and leaves food unset for 'anything'", () => {
    const result = scoreQuiz({ ...answers, food: "anything", interests: ["a", "b", "c", "d"] });
    expect(result.interests).toEqual(["a", "b", "c"]);
    expect(result.foodPreference).toBeNull();
  });

  it("covers every pace and crowd combination with a distinct name", () => {
    const names = new Set<string>();
    for (const pace of ["slow", "balanced", "packed"] as const)
      for (const crowds of ["avoid", "neutral", "love"] as const)
        names.add(scoreQuiz({ ...answers, pace, crowds }).typeName);
    expect(names.size).toBe(9);
  });
});
