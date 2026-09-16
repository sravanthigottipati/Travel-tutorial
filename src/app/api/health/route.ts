import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Public, unauthenticated — for uptime monitoring and post-deploy smoke
// tests (Section 25.1: "Run end-to-end smoke tests after deployment").
// Deliberately reports only up/down, never error details or stack traces,
// so it can't leak infrastructure information to an unauthenticated caller.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
