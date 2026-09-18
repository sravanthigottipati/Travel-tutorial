import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Uses the edge-safe auth config directly (not the full auth.ts, which pulls
// in Prisma/bcrypt and cannot run on the Edge runtime that middleware uses).
export default NextAuth(authConfig).auth;

// Found in a VAPT re-check: /dashboard was in auth.config.ts's
// protectedPrefixes (so its own page-level `auth()` + redirect already
// guards it — no data ever leaked), but missing here, so an unauthenticated
// request to it skipped this edge-level check and rendered further into
// the page before the server component's own redirect fired. Listed for
// defense-in-depth/consistency with the other three, not because anything
// was actually exposed.
export const config = {
  matcher: ["/dashboard/:path*", "/chat/:path*", "/trips/:path*", "/profile/:path*"],
};
