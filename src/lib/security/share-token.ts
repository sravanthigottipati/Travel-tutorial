import { randomBytes } from "crypto";

// 24 random bytes (192 bits) as base64url — far beyond what's practical to
// guess or brute force, since possession of this token IS the entire
// authorization check for the public /shared/[token] page (no login, no
// ownership check, nothing else gates access to that trip's read-only
// view). Base64url keeps it URL-safe with no encoding needed.
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}
