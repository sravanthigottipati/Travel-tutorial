import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "@/lib/auth/credentials";

describe("registerSchema", () => {
  it("accepts a well-formed registration", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "Test@Example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = registerSchema.parse({
      name: "  Test User  ",
      email: "  Test@Example.COM  ",
      password: "password123",
    });
    expect(result.email).toBe("test@example.com");
    expect(result.name).toBe("Test User");
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Test",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 100 characters", () => {
    const result = registerSchema.safeParse({
      name: "a".repeat(101),
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (no length requirement — that's registerSchema's job)", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
  });
});
