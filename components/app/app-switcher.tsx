"use client";

/**
 * AppSwitcher — Growth multi-app selector. Native select (accessible, reliable),
 * styled to the shell; on change it persists the choice and refreshes so every
 * server surface re-resolves to the chosen app. Renders nothing for single-app
 * users.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActiveApp } from "@/lib/app/set-active-app";
import type { AppOption } from "@/lib/app/active-app";

export function AppSwitcher({ apps, activeId }: { apps: AppOption[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (apps.length <= 1) return null;

  return (
    <label className="relative block">
      <span className="sr-only">Switch app</span>
      <select
        value={activeId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await setActiveApp(id);
            router.refresh();
          });
        }}
        className="w-full appearance-none rounded-lg border bg-transparent py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition-colors focus-visible:ring-2 disabled:opacity-60"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--color-fg)" }}
        aria-label="Switch app"
      >
        {apps.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden
        style={{ color: "var(--color-muted)" }}
      >
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
