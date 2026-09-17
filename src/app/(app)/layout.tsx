import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AppNav } from "@/components/app-nav";

// A Fragment, not a wrapping <div>: the root layout's <body> is already
// `flex flex-col` (globals via layout.tsx), so <AppNav/> and each page's
// own flex-1 <main> work as direct flex children without needing an extra
// wrapper element — and a wrapping <div> here broke a real E2E test, since
// Playwright's `page.locator("div", { has: ... })` locators (used to find
// "the div containing Day 2") started matching this new outer div first
// (it contains every day's text too) instead of the specific day card.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <>
      <AppNav user={{ name: session.user.name ?? "", email: session.user.email ?? "" }} />
      {children}
    </>
  );
}
