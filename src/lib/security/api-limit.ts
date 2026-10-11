import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";

// Per-user, per-endpoint limit. Returns a ready 429 response when exceeded,
// otherwise null — `const limited = limitUser(...); if (limited) return limited;`.
export function limitUser(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs = 60_000
): NextResponse | null {
  const result = checkRateLimit(`${endpoint}:${userId}`, limit, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: rateLimitResponseHeaders(result) }
  );
}
