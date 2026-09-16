// Section 22: "Apply rate limiting to public AI endpoints." In-memory
// sliding-window limiter — fine for a single Node process, which is what
// this project targets today (see AGENTS.md/CLAUDE.md — this is a
// single-instance deployment until proven otherwise). It will NOT work
// correctly across multiple serverless instances/regions, since each
// instance has its own memory; a real multi-instance deployment needs a
// shared store (Redis/Upstash — already flagged as an optional later-stage
// component in Section 9's tech stack, for exactly this kind of need).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound memory growth in a long-running process: prune expired buckets
// occasionally rather than on every call.
let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 60_000;

function pruneExpired(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

// Best-effort client IP for unauthenticated endpoints (e.g. registration).
// Trusts X-Forwarded-For, which is fine behind a single known reverse
// proxy (Vercel) but is spoofable if this app is ever exposed directly to
// the internet without one in front of it.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

export function rateLimitResponseHeaders(result: RateLimitResult): HeadersInit {
  return {
    "Retry-After": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}
