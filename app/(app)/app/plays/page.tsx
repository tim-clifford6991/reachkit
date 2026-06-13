/**
 * Plays page — thin shell placeholder.
 *
 * Task 21 (E4) builds the full action queue UI. This stub has the nav entry
 * present so the sidebar link resolves. Do not build the queue here.
 */

import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "This week's plays", path: "/app/plays" });

export default function PlaysPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="max-w-sm rounded-xl border px-8 py-10 text-center"
        style={{
          borderColor: "oklch(1 0 0 / 0.09)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
          style={{
            background: "oklch(0.60 0.18 255 / 0.10)",
            border: "1.5px solid var(--color-accent-900)",
          }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="var(--color-accent-400)" strokeWidth="1.5" />
            <path d="M5 5h6M5 8h4M5 11h5" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Coming in this build
        </p>
        <h1
          className="mt-2 text-base font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          This week&apos;s plays
        </h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Your full action queue with draft copy, effort estimates, and one-click
          verification. Building now in Task 21.
        </p>
      </div>
    </div>
  );
}
