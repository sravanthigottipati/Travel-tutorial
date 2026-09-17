"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "cn";

type Position = "bottom-left" | "bottom-right";

const POSITION_STORAGE_KEY = "tt-preferences-position";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

function readStoredPosition(): Position {
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    return stored === "bottom-left" || stored === "bottom-right" ? stored : "bottom-left";
  } catch {
    return "bottom-left";
  }
}

// A small floating "TT" launcher + preferences panel, present on every
// page (mounted via TTPreferencesLoader, which — like this app's other
// client-only widget, the Leaflet map — loads this with next/dynamic's
// `ssr: false` rather than an SSR-then-mount-flag dance, so there's no
// server/client render to reconcile and reading localStorage directly in
// useState's initializer is safe).
//
// Only real, functional setting is Theme — wired to next-themes, which
// now actually drives the .dark class globals.css already had full CSS
// variables for but nothing was ever switching on. Position is a
// lightweight, purely cosmetic per-viewer convenience, so it's fine to
// keep in localStorage rather than the server — it never needs to be
// read back by anything else.
export function TTPreferences() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>(readStoredPosition);

  function updatePosition(next: Position) {
    setPosition(next);
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, next);
    } catch {
      // Nothing to persist to if storage is blocked — the in-memory
      // state above still updates the UI for this page view.
    }
  }

  const isBottomLeft = position === "bottom-left";

  return (
    <div className={cn("fixed z-50 bottom-4", isBottomLeft ? "left-4" : "right-4")}>
      {open && (
        <div
          className={cn(
            "absolute bottom-12 w-72 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg",
            isBottomLeft ? "left-0" : "right-0"
          )}
        >
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

          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
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

            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Badge position</span>
              <div className="flex gap-1 rounded-lg border border-border p-1">
                {POSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updatePosition(opt.value)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
                      position === opt.value
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
