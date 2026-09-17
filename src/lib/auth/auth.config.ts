import type { NextAuthConfig } from "next-auth";

const protectedPrefixes = ["/dashboard", "/chat", "/trips", "/profile"];

// Edge-safe base config: no providers that touch Prisma/bcrypt (Node-only),
// so this can be imported directly by middleware. The full config with the
// Credentials provider lives in auth.ts and extends this.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Trust the host header Vercel's proxy sets (X-Forwarded-Host) rather
  // than requiring an explicit AUTH_URL — needed for callback URLs and
  // redirects to resolve to the real production domain instead of
  // localhost. Safe specifically because Vercel's edge network sets this
  // header itself; it would NOT be safe on a host directly exposed to the
  // internet without a trusted proxy in front of it.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isProtected = protectedPrefixes.some((prefix) =>
        request.nextUrl.pathname.startsWith(prefix)
      );
      return isProtected ? !!auth?.user : true;
    },
  },
} satisfies NextAuthConfig;
