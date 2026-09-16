import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Welcome, {session.user.name}.</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The conversational trip planner lands in Phase 3. For now, you&apos;re
        signed in and your session is working.
      </p>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/profile">Go to profile</Link>}
      />
    </main>
  );
}
