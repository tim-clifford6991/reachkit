/**
 * Report jump-nav data layer.
 *
 * `buildSectionNavItems` is PURE — it lists only the anchors that will actually
 * render for this report + tier, so a link never points at a missing section.
 * The interactive `SectionNav` (sticky pill row + IntersectionObserver
 * scroll-spy) lives in ./section-nav-active and is re-exported here so existing
 * import sites (`{ SectionNav, buildSectionNavItems }`) stay unchanged.
 */

import type { ReportPayload } from "@/lib/scan/report";

export { SectionNav } from "./section-nav-active";

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
