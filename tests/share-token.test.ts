import { describe, expect, it } from "vitest";
import { generateShareToken } from "@/lib/security/share-token";

describe("generateShareToken", () => {
  it("produces a URL-safe token with no padding or reserved characters", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("has enough entropy that two calls never collide in practice", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateShareToken()));
    expect(tokens.size).toBe(1000);
  });

  it("decodes back to 24 bytes (192 bits) of randomness", () => {
    const token = generateShareToken();
    expect(Buffer.from(token, "base64url").length).toBe(24);
  });
});
