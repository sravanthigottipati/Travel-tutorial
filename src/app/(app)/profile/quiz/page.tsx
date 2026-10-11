import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { QuizForm } from "./quiz-form";

export default async function QuizPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const preferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Travel personality quiz</h1>
        <p className="text-sm text-muted-foreground">
          Five quick questions. Your result is saved to your profile and shapes every plan
          the assistant makes for you.
        </p>
      </div>
      <QuizForm existingInterests={preferences?.interests ?? []} existingFood={preferences?.foodPreference ?? null} />
    </main>
  );
}
