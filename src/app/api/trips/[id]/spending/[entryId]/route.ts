import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { limitUser } from "@/lib/security/api-limit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = limitUser(session.user.id, "spending-delete", 60);
  if (limited) return limited;

  const { id, entryId } = await params;
  const { count } = await prisma.spendEntry.deleteMany({
    where: { id: entryId, tripId: id, trip: { userId: session.user.id } },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
