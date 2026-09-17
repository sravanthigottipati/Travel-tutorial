import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toGeminiParameterSchema } from "@/lib/ai/gemini-client";

// Regression test for a bug found live: Gemini's function-calling schema is
// an OpenAPI 3.0 subset and 400s outright on JSON-Schema keywords
// z.toJSONSchema() emits (confirmed against the real API, not assumed) —
// $schema, additionalProperties, exclusiveMinimum/Maximum.
describe("toGeminiParameterSchema", () => {
  it("strips $schema and additionalProperties", () => {
    const schema = z.toJSONSchema(z.object({ name: z.string() }));
    const result = toGeminiParameterSchema(schema) as Record<string, unknown>;
    expect(result).not.toHaveProperty("$schema");
    expect(result).not.toHaveProperty("additionalProperties");
  });

  it("rewrites exclusiveMinimum/Maximum to minimum/maximum", () => {
    const schema = z.toJSONSchema(z.object({ n: z.number().positive().max(10) }));
    const result = toGeminiParameterSchema(schema) as {
      properties: { n: Record<string, unknown> };
    };
    expect(result.properties.n).not.toHaveProperty("exclusiveMinimum");
    expect(result.properties.n.minimum).toBe(0);
    expect(result.properties.n.maximum).toBe(10);
  });

  it("recurses into nested objects and arrays without dropping valid keywords", () => {
    const schema = z.toJSONSchema(
      z.object({
        items: z.array(z.object({ label: z.string().min(1) })),
      })
    );
    const result = toGeminiParameterSchema(schema) as {
      properties: { items: { items: { properties: { label: Record<string, unknown> } } } };
    };
    expect(result.properties.items.items.properties.label.minLength).toBe(1);
  });

  it("passes through primitives and null unchanged", () => {
    expect(toGeminiParameterSchema("hello")).toBe("hello");
    expect(toGeminiParameterSchema(5)).toBe(5);
    expect(toGeminiParameterSchema(null)).toBeNull();
  });
});
