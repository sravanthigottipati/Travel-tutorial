import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/auth/credentials";
import { authConfig } from "@/lib/auth/auth.config";
import { checkRateLimit } from "@/lib/security/rate-limit";

// Slows down credential-stuffing against a single account (Section 22).
// Keyed by email rather than IP, since NextAuth's authorize() doesn't
// reliably get the request object across every deployment target.
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60_000;

// A bcrypt hash of a value nobody will ever type — compared against on a
// login attempt for a nonexistent email, so authorize() takes roughly the
// same time whether or not the account exists. Without this, skipping
// bcrypt.compare() entirely for an unknown email is a timing side-channel
// an attacker could use to enumerate registered emails (VAPT finding).
const DUMMY_HASH = "$2b$12$LfBjxsQpKvgT2srLrDF4FuKAKqzpHr0t6PSI.C3U42UpZPjCBLBWa";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const rateLimit = checkRateLimit(`login:${email}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
        if (!rateLimit.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Always run bcrypt.compare, even for a nonexistent email — see
        // DUMMY_HASH above.
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !passwordMatches) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
