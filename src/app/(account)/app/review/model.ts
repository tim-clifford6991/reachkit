// The review's one model: the week's window, the rows the screen shows, and every figure, all counted from the same
// rows so no two figures can read different weeks. Pure; `store.ts` reads, the screen renders.
import { WEEK_PLAN } from "@/lib/config/constants";
import type { LinkMap } from "@/lib/known-content/link-map";
import type { CommittedRow, ReviewWeek } from "@/lib/opportunities/review/week";
import type { Label } from "@/lib/opportunities/verdicts/types";

const DAY_MS = 86_400_000;

export type MarkValue = "ok" | "flag";
/** What a press answered: `null` before any press. */
export type MarkResult = "saved" | "failed" | null;

export interface Mark {
  mark: MarkValue;
  note: string | null;
  at: string;
}

/** The marks of one week, keyed `site:opportunity`. */
export type Marks = ReadonlyMap<string, Mark>;

export const markKey = (siteId: string, opportunityId: string): string => `${siteId}:${opportunityId}`;

export interface LivePage {
  id: string;
  url: string;
  /** `null` where the page has no stored reading. */
  label: Label | null;
}

/** One paying site as read, with the raw facts its figures are counted from. */
export interface SiteRead {
  id: string;
  domain: string;
  week: ReviewWeek;
  pages: LivePage[];
  links: LinkMap;
  /** Each row's keyword difficulty, 0–100, by opportunity id; `null` where it was never measured. */
  difficulty: ReadonlyMap<string, number | null>;
  /** When each of its drafts was stopped by the hard rules while it was written. */
  stops: readonly string[];
  verdicts: readonly { publication_id: string; week_start: string; verdict: string }[];
}

/** A site as the screen shows it: its committed rows are the week's dated ones and its spares. */
export type ReviewSite = SiteRead & { committed: CommittedRow[]; dated: number };

export interface Review {
  /** `YYYY-MM-DD`, the Monday the week starts; the window is `[week, week + 7 days)`. */
  week: string;
  sites: ReviewSite[];
  marks: Marks;
  figures: {
    sites: number;
    committed: number;
    of: number;
    /** Sites whose week holds fewer dated pages than a week has days. */
    short: number;
    stopped: number;
    flips: number;
    /** Whether any site has a verdict for this week yet. */
    measured: boolean;
    flags: number;
  };
  flagged: { site: ReviewSite; row: CommittedRow; mark: Mark }[];
}

const dayAfter = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Pages whose verdict this week differs from their latest verdict before it. */
function flipsOf(rows: SiteRead["verdicts"], week: string): number {
  const before = new Map<string, { week: string; verdict: string }>();
  for (const row of rows) {
    const held = before.get(row.publication_id);
    if (row.week_start < week && (held === undefined || row.week_start > held.week)) before.set(row.publication_id, { week: row.week_start, verdict: row.verdict });
  }
  return rows.filter((row) => row.week_start === week && before.has(row.publication_id) && before.get(row.publication_id)!.verdict !== row.verdict).length;
}

export function reviewModel(week: string, read: readonly SiteRead[], marks: Marks): Review {
  const end = dayAfter(week, 7);
  const inWeek = (day: string) => day >= week && day < end;
  const from = Date.parse(`${week}T00:00:00.000Z`), to = Date.parse(`${end}T00:00:00.000Z`);
  const sites = read.map((site): ReviewSite => {
    const committed = site.week.committed.filter((row) => row.day === null || inWeek(row.day));
    return { ...site, committed, dated: committed.filter((row) => row.day !== null).length };
  });
  const flagged = sites.flatMap((site) =>
    site.committed.flatMap((row) => {
      const mark = marks.get(markKey(site.id, row.id));
      return mark?.mark === "flag" ? [{ site, row, mark }] : [];
    })
  );
  const sum = (of: (site: ReviewSite) => number) => sites.reduce((total, site) => total + of(site), 0);
  return {
    week,
    sites,
    marks,
    figures: {
      sites: sites.length,
      committed: sum((site) => site.dated),
      of: WEEK_PLAN.days * sites.length,
      short: sites.filter((site) => site.dated < WEEK_PLAN.days).length,
      stopped: sum((site) => site.stops.filter((at) => Date.parse(at) >= from && Date.parse(at) < to).length),
      flips: sum((site) => flipsOf(site.verdicts, week)),
      measured: sites.some((site) => site.verdicts.some((row) => row.week_start === week)),
      flags: flagged.length,
    },
    flagged,
  };
}
