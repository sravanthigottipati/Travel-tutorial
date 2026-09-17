import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
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
