"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand-logo";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trips", label: "Trips" },
  { href: "/chat", label: "Chat" },
  { href: "/mood", label: "Mood" },
] as const;

type Props = {
  user: { name: string; email: string };
};

export function AppNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <BrandLogo href="/dashboard" />
        <div className="flex flex-1 items-center justify-center gap-1">
          {LINKS.map((link) => {
            // /trips also covers /trips/[id]/... sub-pages, but /dashboard
            // shouldn't match on the /trips prefix.
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2 rounded-full py-1 pl-1 text-sm transition-colors md:pr-3",
            pathname === "/profile" || pathname.startsWith("/profile/")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-40 truncate md:inline">{user.email}</span>
        </Link>
      </nav>
    </header>
  );
}
