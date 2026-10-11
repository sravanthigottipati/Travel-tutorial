import type { NextConfig } from "next";
import path from "path";

// Found in a VAPT review: the app had no security headers at all — most
// notably no clickjacking protection (Section 22's rate-limiting doesn't
// cover this class of attack). Every authenticated page (trip
// creation/deletion, itinerary edits) could be framed by an external site
// and clickjacked, since NextAuth's SameSite=Lax session cookie is still
// attached to same-origin requests a malicious page's iframe makes.
const securityHeaders = [
  // Clickjacking: refuse to be framed at all, matching the fact that
  // nothing in this app is meant to be embedded elsewhere.
  { key: "X-Frame-Options", value: "DENY" },
  // Beyond framing: no plugins/objects, no <base> hijacking, and forms can
  // only post back to this origin. (script-src is deliberately not restricted
  // here — Next.js inlines scripts, and a nonce-based policy is a bigger change.)
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  // Browsers only honour this over HTTPS: keep returning visitors on HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Isolate this site's windows from cross-origin pages (no popups are used).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // MIME-sniffing: stop browsers from re-interpreting a response's
  // Content-Type based on sniffed content.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full referring URL (which can include trip/session
  // identifiers in the path) to third-party origins linked from the app.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is never used. Microphone (voice input) and geolocation (Today
  // mode's "Show my location") are allowed for this origin only — `=()`
  // would make the browser refuse before ever asking the user.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
