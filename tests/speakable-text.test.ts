import { describe, expect, it } from "vitest";
import { splitIntoChunks, toSpeakableText } from "@/lib/speech/speakable-text";

describe("toSpeakableText", () => {
  it("strips emphasis, headings, bullets and links", () => {
    const out = toSpeakableText("## Plan\n**Day 1** - visit [Fort Aguada](https://x.test/a)\n- Beach time");
    expect(out).toBe("Plan. Day 1 - visit Fort Aguada. Beach time.");
    expect(out).not.toMatch(/[*#\[\]()]|https?:/);
  });

  it("reads table rows as comma-separated cells and drops the separator row", () => {
    const out = toSpeakableText("| Meal | Cost |\n|---|---|\n| Lunch | ₹300 |");
    expect(out).toBe("Meal, Cost. Lunch, ₹300.");
  });

  it("drops bare urls, map tags, code blocks and emoji", () => {
    const out = toSpeakableText("Stay here 🏨 [map: https://maps.test/x] see https://a.test\n```\ncode\n```");
    expect(out).toBe("Stay here see.");
  });
});

describe("splitIntoChunks", () => {
  it("keeps short text as a single chunk", () => {
    expect(splitIntoChunks("Hello there. How are you?")).toEqual(["Hello there. How are you?"]);
  });

  it("splits long text into chunks no longer than the limit", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = splitIntoChunks(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });

  it("splits a single oversized sentence on words", () => {
    const text = Array.from({ length: 80 }, () => "word").join(" ");
    expect(splitIntoChunks(text, 50).every((c) => c.length <= 50)).toBe(true);
  });
});
