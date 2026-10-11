import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { ThemeToggleLoader } from "./theme-toggle-loader";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      preferences: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 content-start items-start gap-6 p-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the app looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggleLoader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Travel personality quiz</CardTitle>
          <CardDescription>
            Not sure how to describe your travel style? Five quick questions fill in your
            preferences for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/profile/quiz">Take the quiz</Link>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Travel preferences</CardTitle>
          <CardDescription>
            Used to personalize recommendations and itineraries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialTravelStyle={user.preferences?.travelStyle ?? ""}
            initialFoodPreference={user.preferences?.foodPreference ?? ""}
            initialInterests={user.preferences?.interests ?? []}
          />
        </CardContent>
      </Card>
    </main>
  );
}
