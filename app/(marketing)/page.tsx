import type { Metadata } from "next";
import { buildMetadata, softwareApplicationLd, SITE } from "@/lib/seo";
import { ScanInput } from "./scan-input";

export const metadata: Metadata = buildMetadata({
  title: "The distribution system for solo founders",
  description:
    "Paste your App Store URL or website and get a free discoverability report — SEO gaps, positioning blind spots, and ranked action steps in under two minutes.",
  path: "/",
});

// Static recent-scan ticker items — provides immediate social proof above the fold.
// Real-time data can replace this in a later cycle via a Server Component that
// queries a scan count; for now static items keep the bundle tight.
const RECENT_ITEMS = [
  "a journaling app · 63 / 100",
  "invoicing tool · 41 / 100",
  "fitness tracker · 77 / 100",
  "recipe SaaS · 29 / 100",
  "habit tracker · 55 / 100",
] as const;

export default function HomePage() {
  const ld = softwareApplicationLd({
    name: SITE.name,
    url: SITE.url,
    priceUsd: 0,
  });

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-[--spacing-content-x] py-20"
      style={{ background: "var(--color-bg)" }}
    >
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      {/* Ambient background glow — CSS-only, no JS */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-48 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-[0.07]"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-xl space-y-12">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="space-y-5 text-center">
          {/* Eyebrow */}
          <p
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider"
            style={{
              borderColor: "var(--color-accent-subtle)",
              background: "var(--color-accent-subtle)",
              color: "var(--color-accent-400)",
            }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: "var(--color-accent-400)" }}
              aria-hidden="true"
            />
            Free · no account needed
          </p>

          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--color-fg)" }}
          >
            Find out exactly why
            <br />
            <span style={{ color: "var(--color-accent)" }}>
              your product isn&apos;t
            </span>
            <br />
            getting found
          </h1>

          <p
            className="mx-auto max-w-md text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--color-muted)" }}
          >
            Paste your App Store URL or website — get a discoverability score,
            positioning gap, and ranked action steps in ~90 seconds.
          </p>
        </div>

        {/* ── Scan input — the ONE action above the fold ────────────────── */}
        <ScanInput />

        {/* ── Live ticker — social proof without nav distraction ─────────── */}
        <div className="space-y-3">
          <p
            className="text-center font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Recent scans
          </p>
          <div
            className="flex flex-wrap justify-center gap-2"
            aria-label="Recent scans"
          >
            {RECENT_ITEMS.map((item) => (
              <span
                key={item}
                className="rounded-full border px-2.5 py-1 font-mono text-xs"
                style={{
                  borderColor: "oklch(1 0 0 / 0.08)",
                  color: "var(--color-muted)",
                  background: "oklch(1 0 0 / 0.02)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
