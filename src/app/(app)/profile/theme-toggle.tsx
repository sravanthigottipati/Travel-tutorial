"use client";

import { useTheme } from "next-themes";
import { cn } from "cn";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

// Lives on the Profile page now — a floating "TT" badge used to hold this
// (and a since-removed Position setting), but that's gone per feedback in
// favor of Theme living where settings conventionally live.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-1 rounded-lg border border-border p-1">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            theme === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
