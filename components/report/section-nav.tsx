/**
 * SectionNav — a sticky, horizontally-scrollable row of jump links to the
 * report's section anchors (ChannelIntel UX). Dependency-free: native anchor
 * scroll + `scroll-mt` on each `DeepSection`. Server-rendered.
 *
 * `buildSectionNavItems` is PURE — it lists only the anchors that will actually
 * render for this report + tier, so a link never points at a missing section.
 * The nav hides itself when there are too few targets (the free light report).
 */

import type { ReportPayload } from "@/lib/scan/report";

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * Which section anchors exist for this (already-redacted) report + tier. Mirrors
 * the render conditions in market-analysis-sections.tsx so jump links stay live.
 */
export function buildSectionNavItems(
  report: ReportPayload,
  opts: { unlocked: boolean },
): SectionNavItem[] {
  const items: SectionNavItem[] = [{ id: "summary", label: "Summary" }];
  const m = report.market;
  if (!m) return items;

  if (m.cohort.competitors.length > 0) items.push({ id: "competitors", label: "Competitors" });

  const sov = m.gap.shareOfVoice;
  const hasKw = m.cohort.self.seo != null && m.cohort.competitors.some((c) => c.seo != null);
  if (hasKw || sov) items.push({ id: "benchmark", label: "Benchmark" });

  if (m.gap.channelMatrix.some((r) => r.self.present || r.competitorsActive > 0)) {
    items.push({ id: "channels", label: "Channels" });
  }
  if (opts.unlocked && m.gap.keywordGap.length > 0) items.push({ id: "keyword-gap", label: "Keyword gap" });
  if (opts.unlocked && (m.cohort.self.seo?.topPages?.length ?? 0) > 0) {
    items.push({ id: "top-pages", label: "Top pages" });
  }
  if (m.gap.demandPockets.length > 0) items.push({ id: "demand", label: "Demand" });
  if (opts.unlocked && (m.recentBuzz?.length ?? 0) > 0) items.push({ id: "buzz", label: "Buzz" });
  if (m.plan.items.length > 0) items.push({ id: "playbook", label: "Playbook" });

  return items;
}

export function SectionNav({ items }: { items: SectionNavItem[] }) {
  // Nothing worth jumping between → render nothing (free light report).
  if (items.length < 3) return null;
  return (
    <nav
      aria-label="Report sections"
      className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-full border px-1.5 py-1.5 backdrop-blur"
      style={{
        borderColor: "var(--hairline)",
        background: "color-mix(in oklch, var(--color-surface) 80%, transparent)",
      }}
    >
      <ul className="flex w-max items-center gap-1">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors hover:bg-[var(--fill-subtle)]"
              style={{ color: "var(--color-muted)" }}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
