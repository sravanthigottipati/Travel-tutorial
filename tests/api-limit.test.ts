import { describe, expect, it } from "vitest";
import { limitUser } from "@/lib/security/api-limit";

describe("limitUser", () => {
  it("allows up to the limit, then returns a 429 with Retry-After", async () => {
    const user = `u-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(limitUser(user, "test-endpoint", 3)).toBeNull();
    const blocked = limitUser(user, "test-endpoint", 3);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await blocked?.json()).toEqual({ error: "Too many requests. Please slow down." });
  });

  it("keeps separate budgets per user and per endpoint", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(limitUser(a, "e1", 1)).toBeNull();
    expect(limitUser(a, "e1", 1)?.status).toBe(429);
    expect(limitUser(b, "e1", 1)).toBeNull();
    expect(limitUser(a, "e2", 1)).toBeNull();
  });
});
