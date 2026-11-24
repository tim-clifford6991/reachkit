// SPEC §7 *This week* — a planned day's why and what has been read for it, and what a written page adds: every
// sentence from the reason, evidence and draft the week already read, at 0¢. A field not stored says nothing.
import { copy } from "@/lib/presentation/copy";
import type { Evidence, PlanReason, PointPart } from "@/lib/opportunities/types";
import { WHY_LINE, whyOf, writtenDay } from "@/lib/opportunities/why";
import { formatCount } from "../_shell/format";

/** One sentence; `link` is a passage inside it that opens its source, with the words that follow it. */
export interface ReasonRow {
  text: string;
  link: { words: string; href: string; after: string } | null;
}

export interface ResearchModel {
  counts: { label: string; value: string }[];
  /** Said in the counts' place where the research is waiting or thin. */
  line: string | null;
  label: string;
  pages: { host: string; url: string }[];
  later: string;
}

export interface Brief {
  reasons: ReasonRow[];
  /** The parts that lowered its rank: a note, never a reason it was picked. */
  notes: string[];
  research: ResearchModel | null;
}

const ORDER: readonly PointPart[] = [...new Set(WHY_LINE.map((line) => line.part)), "rising", "new_site"];
const LOWERING: readonly PointPart[] = ["outsized", "no_footprint"];

const row = (text: string): ReasonRow => ({ text, link: null });

/** "19 Nov" for a stored instant, which jsonb may hold as a string; `null` where it does not read as one. */
function dayOf(value: unknown): string | null {
  const at = new Date(value as string);
  return Number.isNaN(at.getTime()) ? null : writtenDay(at.toISOString().slice(0, 10));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** The sentence one stored part says, from the evidence where it holds the detail; `null` where it says nothing. */
function sentenceOf(part: PlanReason["parts"][number], evidence: Evidence): string | null {
  const write = evidence.family === "write" ? evidence : null;
  const trend = evidence.family === "write" || evidence.family === "earn" ? evidence.trend : undefined;
  switch (part.part) {
    case "fit":
      return copy(part.n >= 3 ? "calendar.reason.fit" : "calendar.reason.fit.helps");
    case "demand": {
      const asked = part.n < 2 ? write?.askedBeside : undefined;
      const seen = asked === undefined ? null : dayOf(asked.serpAt);
      if (asked !== undefined && seen !== null) return copy("calendar.reason.asked.where", { term: asked.term, date: seen });
      return copy(part.n >= 2 ? "calendar.reason.searched" : "calendar.reason.asked");
    }
    case "ai_gap":
      // A `ranked` win is a Google place, not an AI answer.
      return write?.prompt !== undefined && write.win !== undefined && write.win.signal !== "ranked"
        ? copy("calendar.reason.ai-gap.prompt", { prompt: write.prompt.text, competitor: write.win.competitor })
        : copy("calendar.reason.ai-gap");
    case "rising": {
      const since = write?.askedBeside?.newSince == null ? null : dayOf(write.askedBeside.newSince);
      if (since !== null) return copy("calendar.reason.rising.new", { date: since });
      return typeof trend?.quarterly === "number" ? copy("calendar.reason.rising", { pct: formatCount(Math.round(trend.quarterly)) }) : null;
    }
    case "near_page_one":
      return copy("calendar.reason.near-page-one");
    case "not_moving":
      return copy("calendar.reason.not-moving");
    case "shown_no_visits":
      return copy("calendar.reason.shown-no-visits", { n: formatCount(part.shown ?? part.n) });
    case "linked_by_ai":
      return copy("calendar.reason.linked-by-ai");
    case "new_site":
      return copy("calendar.reason.new-site");
    case "outsized":
      return copy("calendar.reason.outsized");
    case "no_footprint":
      return copy("calendar.reason.no-footprint");
    // A dated event says its own sentence first; a search with no demand is never in a week.
    case "timely":
    case "no_demand":
      return null;
  }
}

/** The fit fact the topic was judged on, its passage linked to the page that says it. */
function fitFactRow(evidence: Evidence): ReasonRow | null {
  const fact = evidence.family === "write" || evidence.family === "earn" ? evidence.fitFact : null;
  if (fact == null || fact.text.trim() === "") return null;
  const mark = "\u0000";
  const [before = "", after = ""] = copy("calendar.reason.fit-fact", { passage: mark }).split(mark);
  if (fact.source.kind !== "page") return row(`${before}${fact.text}${after}`);
  return { text: before, link: { words: fact.text, href: fact.source.url, after } };
}

function angleRow(evidence: Evidence): ReasonRow | null {
  const angle = evidence.family === "write" || evidence.family === "earn" ? evidence.angle : null;
  if (angle == null || angle.promise.trim() === "") return null;
  if (angle.gap === 1) return row(copy("calendar.reason.angle.one", { promise: angle.promise }));
  return row(angle.gap > 0 ? copy("calendar.reason.angle", { promise: angle.promise, gap: formatCount(angle.gap) }) : copy("calendar.reason.angle.none", { promise: angle.promise }));
}

function researchOf(research: PlanReason["research"], search: string, writing: boolean): ResearchModel | null {
  if (research === undefined) return null;
  const hosts = new Map<string, string>();
  for (const url of research.urls) {
    const host = hostOf(url);
    if (host !== null && !hosts.has(host)) hosts.set(host, url);
  }
  const counted = research.state === "met" || research.state === "at_margin";
  const counts = (
    [
      ["calendar.pane.research.pages", research.R],
      ["calendar.pane.research.questions", research.Q],
      ["calendar.pane.research.figures", research.F],
    ] as const
  ).flatMap(([key, n]) => (counted && typeof n === "number" ? [{ label: copy(key), value: formatCount(n) }] : []));
  return {
    counts,
    // Writing starts only after the read, so the commit's "still reading" snapshot is no longer true.
    line: research.state === "queued" ? (writing ? null : copy("calendar.pane.research.queued")) : research.state === "short" ? copy("calendar.pane.research.short") : null,
    label: copy("calendar.pane.research.list.label", { search }),
    pages: [...hosts].map(([host, url]) => ({ host, url })),
    later: copy("calendar.pane.research.later"),
  };
}

/** A planned page's why, in `WHY_LINE` order then the rest, and what has been read for it. */
export function briefOf(plan: { reason: PlanReason | null; evidence: Evidence } | undefined, search: string, writing = false): Brief {
  if (plan === undefined) return { reasons: [], notes: [], research: null };
  const { reason, evidence } = plan;
  const parts = reason?.parts ?? [];
  const said = (each: readonly PointPart[]) =>
    each.flatMap((name) => parts.filter((part) => part.part === name).flatMap((part) => sentenceOf(part, evidence) ?? []));
  const news = whyOf(reason);
  return {
    reasons: [
      ...(news?.sentence === "calendar.reason.news" ? [row(copy(news.sentence, news.values))] : []),
      ...[...new Set(said(ORDER))].map(row),
      ...[fitFactRow(evidence), angleRow(evidence)].flatMap((each) => (each === null ? [] : [each])),
    ],
    notes: said(LOWERING),
    research: researchOf(reason?.research, search, writing),
  };
}

/** What a written page adds over Google's top pages, from `meta.adds`; `null` where none is stored or it adds none. */
export function addsLine(meta: unknown): string | null {
  const claims = (meta as { adds?: { claims?: unknown } } | null)?.adds?.claims;
  if (!Array.isArray(claims)) return null;
  const facts = claims.filter((each): each is { business?: unknown } => typeof (each as { claim?: unknown } | null)?.claim === "string");
  const own = facts.filter((each) => each.business === true).length;
  if (facts.length === 0) return null;
  const lead = facts.length === 1 ? copy("calendar.pane.adds.one") : copy("calendar.pane.adds", { n: formatCount(facts.length) });
  if (own === 0) return lead;
  return `${lead} ${facts.length === 1 ? copy("calendar.pane.adds.business.one") : copy("calendar.pane.adds.business", { b: formatCount(own) })}`;
}
