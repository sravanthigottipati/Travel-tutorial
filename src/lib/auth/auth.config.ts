import type { NextAuthConfig } from "next-auth";

const protectedPrefixes = ["/chat", "/trips", "/profile"];

// Edge-safe base config: no providers that touch Prisma/bcrypt (Node-only),
// so this can be imported directly by middleware. The full config with the
// Credentials provider lives in auth.ts and extends this.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
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
