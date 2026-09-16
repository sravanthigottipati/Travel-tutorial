import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Uses the edge-safe auth config directly (not the full auth.ts, which pulls
// in Prisma/bcrypt and cannot run on the Edge runtime that middleware uses).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/chat/:path*", "/trips/:path*", "/profile/:path*"],
};
