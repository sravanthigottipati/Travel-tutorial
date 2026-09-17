"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "cn";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

// A small floating "TT" launcher + preferences panel, present on every
// page (mounted via TTPreferencesLoader, which — like this app's other
// client-only widget, the Leaflet map — loads this with next/dynamic's
// `ssr: false` rather than an SSR-then-mount-flag dance, so there's no
// server/client render to reconcile).
//
// Fixed at bottom-left — no configurable position (an earlier version
// had a Position setting here; removed per feedback that it wasn't
// wanted, in favor of just one standard, predictable spot).
//
// Only real, functional setting is Theme — wired to next-themes, which
// now actually drives the .dark class globals.css already had full CSS
// variables for but nothing was ever switching on.
export function TTPreferences() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed z-50 bottom-4 left-4">
      {open && (
        <div className="absolute bottom-12 left-0 w-72 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Preferences</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close preferences"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Theme</span>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
                    theme === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open preferences"
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105"
      >
        TT
      </button>
    </div>
  );
}
