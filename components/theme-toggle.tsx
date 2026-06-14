"use client";

/**
 * ThemeToggle — light/dark switch backed by next-themes.
 *
 * Both icons are always rendered; the `.dark` class (Tailwind `dark:` variant)
 * decides which is visible. This avoids a mounted-state effect entirely (no
 * hydration mismatch, no setState-in-effect), and the icon is always correct
 * because it's driven by the same class next-themes toggles.
 */

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
