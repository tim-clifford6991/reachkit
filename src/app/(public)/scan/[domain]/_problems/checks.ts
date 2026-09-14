// SPEC §9 — the technical checks beside the three problem cards.
//
// Eight checks, closed, in SPEC §9's order, each with its title and who
// fixes it (the 2026-09-14 ruling). "AI readers blocked" is the ninth and
// stays the existing `blocked_readers` card.
//
// The counts are the scan engine's (#570). This file reads what the engine
// hands it and invents nothing: a check the engine did not report is
// `not_run` — absent with one why-line (SPEC §9), never a zero and never "Nothing to
// fix". Severity arrives with the count; no threshold is restated here.
//
// Copyable lines exist only where the line is fixed text: the viewport meta
// line and the robots `Sitemap:` line. Neither can block a crawler.
import { measured, measuredZero, type Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE } from "@/lib/presentation/site-issues";
import { DOER_OF, type IssueSeverity, type SiteIssuesSection } from "@/lib/site-issues/types";
import type { Severity } from "./model";

export type TechnicalCheck =
  | "page_titles"
  | "meta_descriptions"
  | "noindex_pages"
  | "sitemap"
  | "slow_pages"
  | "broken_links"
  | "phone_usability"
  | "structured_data";

export const CHECK_ORDER: readonly TechnicalCheck[] = Object.freeze([
  "page_titles",
  "meta_descriptions",
  "noindex_pages",
  "sitemap",
  "slow_pages",
  "broken_links",
  "phone_usability",
  "structured_data",
]);

export type Doer = "free_fix" | "reachkit_writes" | "reachkit_rewrites";

export const DOER_KEY: Readonly<Record<Doer, CopyKey>> = Object.freeze({
  free_fix: "check.doer.free-fix",
  reachkit_writes: "check.doer.reachkit-writes",
  reachkit_rewrites: "check.doer.reachkit-rewrites",
});


/** What the engine reports for one check. `sitemapUrl` is the address the
 *  site's sitemap is served at, where the engine found one to point to. */
export interface CheckReading {
  count: Measured<number>;
  severity: Measured<Severity>;
  sitemapUrl?: string;
}

export type CheckReadings = Partial<Readonly<Record<TechnicalCheck, CheckReading>>>;

export type CheckFix =
  | { kind: "not_run" } // the engine reported nothing for this check
  | { kind: "unknown" } // reported, and unmeasured
  | { kind: "none_needed" } // a measured zero
  | { kind: "paste"; lines: readonly string[] }
  | { kind: "doer_only" }; // measured, and nothing fixed to paste

export interface CheckCard {
  check: TechnicalCheck;
  title: CopyKey;
  doer: CopyKey;
  reading: CheckReading | null;
  fix: CheckFix;
}

// HTML and robots.txt protocol text, pasted as-is — not sentences a person
// reads, so not copy keys (the same footing as `unblock.ts`'s directives).
export const VIEWPORT_LINE = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const SITEMAP_FIELD = "Sitemap";

function linesFor(check: TechnicalCheck, reading: CheckReading): readonly string[] {
  if (check === "phone_usability") return [VIEWPORT_LINE];
  if (check === "sitemap" && reading.sitemapUrl !== undefined) {
    return [`${SITEMAP_FIELD}: ${reading.sitemapUrl}`];
  }
  return [];
}

function fixFor(check: TechnicalCheck, reading: CheckReading | null): CheckFix {
  if (reading === null) return { kind: "not_run" };
  if (reading.count.kind === "unmeasured") return { kind: "unknown" };
  if (reading.count.kind === "zero") return { kind: "none_needed" };
  const lines = linesFor(check, reading);
  return lines.length === 0 ? { kind: "doer_only" } : { kind: "paste", lines };
}

export function checkCardsOf(readings: CheckReadings): readonly CheckCard[] {
  return CHECK_ORDER.map((check): CheckCard => {
    const reading = readings[check] ?? null;
    return {
      check,
      title: SITE_CHECK_TITLE[check],
      // SPEC §9, 2026-09-14 — the engine's own map (`DOER_OF`).
      doer: DOER_KEY[DOER_OF[check]],
      reading,
      fix: fixFor(check, reading),
    };
  });
}

const SEVERITY_OF: Readonly<Record<IssueSeverity, Severity>> = Object.freeze({
  nothing_to_fix: "low",
  worth_fixing: "mid",
  critical: "high",
});

/** The stored section (#570) as this module's readings. A check that could
 *  not run is left out, so its card is absent with its why-line. A report
 *  written before the checks existed (`null`) reports none. */
export function readingsOf(section: SiteIssuesSection | null, at: Date): CheckReadings {
  const readings: Partial<Record<TechnicalCheck, CheckReading>> = {};
  for (const issue of section?.issues ?? []) {
    if (!issue.ran || issue.check === "ai_readers_blocked") continue;
    readings[issue.check] = {
      count: issue.count === 0 ? measuredZero(0, at) : measured(issue.count, at),
      severity: measured(SEVERITY_OF[issue.severity], at),
    };
  }
  return readings;
}
