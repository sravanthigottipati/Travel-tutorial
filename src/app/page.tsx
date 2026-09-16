import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">AI Travel Planner</h1>
        <p className="max-w-md text-muted-foreground">
          Describe your trip in plain language and get a personalized
          itinerary, budget and recommendations.
        </p>
      </div>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/register">Get started</Link>} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/login">Log in</Link>}
        />
      </div>
    </main>
  );
}
