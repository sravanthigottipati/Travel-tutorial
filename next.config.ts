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
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // MIME-sniffing: stop browsers from re-interpreting a response's
  // Content-Type based on sniffed content.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full referring URL (which can include trip/session
  // identifiers in the path) to third-party origins linked from the app.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera/geolocation are never used. The microphone is allowed for this
  // origin only (voice input); `microphone=()` blocked it everywhere, so the
  // browser refused access before ever asking the user.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
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
