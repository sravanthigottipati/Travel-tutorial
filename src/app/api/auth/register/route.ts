import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/auth/credentials";
import { checkRateLimit, getClientIp, rateLimitResponseHeaders } from "@/lib/security/rate-limit";
import { Prisma } from "@/generated/prisma/client";

// Public, unauthenticated endpoint — rate limit by IP to slow down
// automated account-creation spam (Section 22).
const REGISTER_RATE_LIMIT = 5;
const REGISTER_RATE_WINDOW_MS = 60 * 60_000;

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(
    `register:${getClientIp(request)}`,
    REGISTER_RATE_LIMIT,
    REGISTER_RATE_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many accounts created from this network. Try again later." },
      { status: 429, headers: rateLimitResponseHeaders(rateLimit) }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        preferences: { create: {} },
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    // Two concurrent registrations for the same email both pass the
    // findUnique check above (TOCTOU gap), then race on this create() —
    // the DB's own unique constraint on User.email correctly rejects the
    // second one, but left uncaught that surfaced as an unhandled 500
    // instead of the same 409 a sequential duplicate gets above.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
