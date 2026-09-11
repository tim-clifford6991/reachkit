"use client";

/**
 * The preview app's own chrome. Drawn entirely in --pv-* — nothing here is
 * a product surface, and nothing here is judged.
 *
 * The theme control has THREE positions because BUILD.md §2.1's theming has
 * three states: no data-theme attribute (follow the OS), data-theme="light"
 * (the explicit light pin), data-theme="dark" (the explicit dark pin). A
 * two-position toggle would leave the guarded @media branch untestable,
 * which is exactly the branch a static sheet could never exercise at all.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ROUTES } from "./routes";

type ThemeChoice = "system" | "light" | "dark";

export function PreviewChrome() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const el = document.documentElement;
    if (choice === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", choice);
  }, [choice]);

  return (
    <header className="pv-bar">
      <Link href="/" className="pv-brand">
        ReachKit preview
      </Link>
      <nav className="pv-nav">
        {ROUTES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="pv-link"
            data-current={pathname === r.href ? "true" : "false"}
          >
            {r.short}
          </Link>
        ))}
      </nav>
      <span className="pv-flag">nothing here is signed</span>
      <div className="pv-toggle" role="group" aria-label="theme">
        <button type="button" data-current={choice === "system" ? "true" : "false"} onClick={() => setChoice("system")}>
          <Monitor size={14} strokeWidth={2} aria-hidden /> system
        </button>
        <button type="button" data-current={choice === "light" ? "true" : "false"} onClick={() => setChoice("light")}>
          <Sun size={14} strokeWidth={2} aria-hidden /> light
        </button>
        <button type="button" data-current={choice === "dark" ? "true" : "false"} onClick={() => setChoice("dark")}>
          <Moon size={14} strokeWidth={2} aria-hidden /> dark
        </button>
      </div>
    </header>
  );
}
