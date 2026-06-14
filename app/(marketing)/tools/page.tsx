import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free tools",
  description:
    "Free discoverability tools for solo founders — scan your App Store listing or website and get a Discoverability Score, no account needed.",
  path: "/tools",
});

interface Tool {
  name: string;
  blurb: string;
  href?: string;
  live: boolean;
}

const TOOLS: readonly Tool[] = [
  {
    name: "Discoverability Score",
    blurb: "Paste any App Store URL or website and get a 0–100 score across 18 signals, plus your biggest gaps — free, no account.",
    href: "/scan",
    live: true,
  },
  { name: "ASO title & subtitle checker", blurb: "Grade your App Store title and subtitle for keyword coverage and wasted characters.", live: false },
  { name: "Keyword density checker", blurb: "See which keywords your listing actually ranks for vs. the queries your buyers type.", live: false },
  { name: "Metadata completeness audit", blurb: "Spot missing titles, descriptions, structured data and alt text holding your page back.", live: false },
  { name: "Competitor gap finder", blurb: "Compare your discoverability against the apps outranking you in your category.", live: false },
];

export default function ToolsPage() {
  return (
    <main
      className="mx-auto max-w-[var(--spacing-content-max)] px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 sm:pt-28"
      aria-label="Free tools"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
          Free tools
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--color-fg)", lineHeight: 1.05 }}>
          Free tools to help you get found
        </h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Start with a full Discoverability Score — free, no account. More focused checkers are on
          the way.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => {
          const card = (
            <div
              className="flex h-full flex-col gap-3 rounded-2xl border p-7 shadow-[var(--elevation-sm),var(--edge-highlight)] transition-transform"
              style={{
                borderColor: t.live ? "var(--color-accent-900)" : "var(--hairline)",
                background: "var(--gradient-surface)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
                  {t.name}
                </h2>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                  style={
                    t.live
                      ? { background: "var(--color-accent-subtle)", color: "var(--color-accent-400)" }
                      : { background: "var(--fill-subtle)", color: "var(--color-muted)" }
                  }
                >
                  {t.live ? "Free" : "Soon"}
                </span>
              </div>
              <p className="flex-1 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {t.blurb}
              </p>
              {t.live && (
                <span className="text-sm font-semibold" style={{ color: "var(--color-accent-400)" }}>
                  Run a free scan →
                </span>
              )}
            </div>
          );
          return t.href ? (
            <Link key={t.name} href={t.href} className="group hover:-translate-y-1 transition-transform motion-reduce:transform-none">
              {card}
            </Link>
          ) : (
            <div key={t.name} className="opacity-80">
              {card}
            </div>
          );
        })}
      </div>
    </main>
  );
}
