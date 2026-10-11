import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { MoodForm } from "./mood-form";

export default async function MoodPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Mood Match</h1>
        <p className="text-sm text-muted-foreground">
          Don&apos;t know where to go? Describe a feeling, an aesthetic, or paste an Instagram
          caption — we&apos;ll find destinations that match the vibe.
        </p>
      </div>
      <MoodForm />
    </main>
  );
}
