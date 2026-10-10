import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { matchMood } from "@/lib/ai/mood-match";
import { MAX_MOOD_INPUT } from "@/lib/ai/mood-match-shared";
import { checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";

const bodySchema = z.object({ text: z.string().trim().min(3).max(MAX_MOOD_INPUT) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`mood:${session.user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitResponseHeaders(limit) }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Describe your mood in a few words." }, { status: 400 });
  }

  const result = await matchMood(parsed.data.text);
  return NextResponse.json({ result });
}
