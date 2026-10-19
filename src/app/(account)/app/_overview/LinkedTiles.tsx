// SPEC §4 (owner, 2026-10-15, issue 1457) — the core data at a glance.
//
// Four tiles, in the #1444 vocabulary: the **Visibility Score**, **Google**,
// **AI** and **Content**, then the biggest gap. Each number is read through
// the one selector its detail screen reads, and each tile that counts items
// opens exactly those items: Google opens the Google tab's rows for the
// searches the live pages target (`yourPages`, issue 1551), AI opens the AI tab's list with the counted
// rows marked (`aiSearchesOf`), and Content opens Plan's *Published* list
// (`contentOf`). The score counts no items, so it opens nothing.
//
// Each linked tile is an `<a>`, not a card with a link inside it: the whole
// box is the control, and a nested control inside a link is not something
// a keyboard can reach twice.
//
// **A number nobody has is never a zero.** Before a reading exists the
// tile says when it will ("First scan Mon, Oct 19"); a read that failed
// says it could not be read.
//
// **It cannot overflow.** Two columns below `lg` and one row above it;
// every tile is `min-w-0`, its lines wrap inside its own column and its
// figure is never clamped — the box changes instead (docs/DESIGN.md's
// no-overflow rule).
import type React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { REGION, TILES } from "./frame";
import { LIMITING_LINES, SCORE_BANDS, type ShownFactor } from "@/lib/presentation/bands";
import { CONTENT_RECENT_WEEKS } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import { formatDate } from "../_shell/format";
import { formatCount, renderValue } from "./present";
import type { OverviewModel } from "./model";
import { aiSearchesOf, type PromptsModel } from "./prompts-model";
import type { ContentModel } from "./content";

const SCORE_LABEL = "overview.tile.score.label" satisfies CopyKey;
const GOOGLE_LABEL = "overview.tab.search" satisfies CopyKey;
const AI_LABEL = "overview.tile.ai-answers.label" satisfies CopyKey;
const CONTENT_LABEL = "overview.tile.content.label" satisfies CopyKey;

/** Where each counting tile opens: the rows it counts. */
const GOOGLE_HREF = "/app/search?show=live";
const AI_HREF = "/app/ai-answers#prompts-list";
const CONTENT_HREF = "/app/calendar#published";

const ESTIMATE_LINE: Readonly<Record<"rough" | "close", CopyKey>> = Object.freeze({
  rough: "verdict.estimate.rough",
  close: "verdict.estimate.close",
});

/** The Google tab's pages reading (issue 1551), declared by shape so this
 *  file does not import that tab's model (its graph reaches the vendor
 *  clients; see `(tabs)/page.tsx`). */
export interface GoogleReading {
  value: Measured<number>;
  of: Measured<number>;
  reading?: { kind: "queue" } | { kind: "pages"; firstPage: number; further: number; unseen: number };
}

const INK = "text-base-content/70";

/** What a figure is read against, drawn bare beside it. A count with
 *  words, so it is `num-phrase` and folds between them. */
function Against(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className={`num num-phrase min-w-0 text-sm ${INK}`}>{p.children}</span>;
}

/** A change since last week, written; `null` where none can be stated. */
function changeLine(change: number | undefined): string | null {
  if (change === undefined) return null;
  if (change === 0) return copy("overview.tile.no-change");
  return copy("overview.tile.change", {
    mark: copy(change < 0 ? "overview.delta.down" : "overview.delta.up"),
    value: formatCount(Math.abs(change)),
  });
}

/** One tile: its name, the figure and what it is read against, then its
 *  lines. A tile with no figure shows its first line where the figure
 *  would stand. */
function Tile(p: {
  label: string;
  testId: string;
  /** Where the tile opens; absent for a number that counts no items. */
  href?: string;
  /** `null` where there is no reading. */
  figure: string | null;
  against?: React.ReactNode;
  change?: string | null;
  lines: readonly (string | null)[];
}): React.JSX.Element {
  const lines = p.lines.filter((line): line is string => line !== null);
  const change = p.change ?? null;
  const body = (
    <div className="card-body gap-2 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide ${INK}`}>{p.label}</span>
        {p.href === undefined ? null : (
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={`shrink-0 ${INK} ${ARROW_NUDGE}`} />
        )}
      </div>
      {p.figure === null ? null : (
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="figure text-4xl leading-none" data-testid={`${p.testId}-value`}>
            {p.figure}
          </span>
          {p.against}
        </div>
      )}
      {change === null ? null : (
        <p className={`text-xs ${INK}`} data-testid={`${p.testId}-change`}>
          {change}
        </p>
      )}
      {lines.map((line) => (
        <p key={line} className={`text-xs ${INK}`}>
          {line}
        </p>
      ))}
    </div>
  );
  return p.href === undefined ? (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      {body}
    </section>
  ) : (
    <Link
      href={p.href}
      prefetch={true}
      className={`card card-border min-w-0 bg-base-100 hover:border-primary ${CARD_LIFT}`}
      data-testid={p.testId}
    >
      {body}
    </Link>
  );
}

export function LinkedTiles(p: {
  score: OverviewModel["score"];
  biggestGap: ShownFactor | null;
  /** `null` where the Google tab's read failed. */
  google: GoogleReading | null;
  prompts: PromptsModel;
  /** `null` where the published pages could not be read. */
  content: ContentModel | null;
  /** When the next page goes live, or `null` where none is scheduled. */
  nextAt: Date | null;
  firstDueOn: Date;
  timeZone: string;
}): React.JSX.Element {
  const firstScan = copy("overview.tile.first-scan", { due: formatDate(p.firstDueOn, p.timeZone) });
  const gap = p.biggestGap === null ? null : LIMITING_LINES[p.biggestGap];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={TILES} data-testid="overview-tiles" data-frame={REGION.tiles}>
        <ScoreTile score={p.score} firstScan={firstScan} />
        <GoogleTile google={p.google} firstScan={firstScan} />
        <AiTile prompts={p.prompts} firstScan={firstScan} />
        <ContentTile content={p.content} nextAt={p.nextAt} timeZone={p.timeZone} />
      </div>
      {gap === null ? null : (
        <div className="card card-border min-w-0 bg-base-100" data-testid="overview-gap">
          <div className="card-body gap-1 p-4">
            <p className="font-semibold">{copy(gap.title)}</p>
            <p className={`text-sm ${INK}`}>{copy(gap.line)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** The Visibility Score: the figure, its band, its range and how sure it
 *  is, and its change on the scan before. */
function ScoreTile(p: { score: OverviewModel["score"]; firstScan: string }): React.JSX.Element {
  const value = renderValue(p.score.headline.value, SCORE_LABEL);
  const delta = p.score.headline.delta;
  const change = delta === undefined || delta.kind === "unmeasured" ? undefined : delta.value;
  const estimate = p.score.estimate;
  return (
    <Tile
      label={copy(SCORE_LABEL)}
      testId="overview-tile-score"
      figure={value.isDash ? null : value.text}
      against={p.score.band === null ? null : <Against>{copy(SCORE_BANDS[p.score.band])}</Against>}
      change={value.isDash ? null : changeLine(change)}
      lines={
        value.isDash
          ? [p.firstScan]
          : [estimate === null ? null : copy(ESTIMATE_LINE[estimate.confidence], { low: formatCount(estimate.low), high: formatCount(estimate.high) })]
      }
    />
  );
}

/** Google (owner, 2026-10-19, issue 1551): the searches the live pages
 *  target that Google shows the site for at places 1–100, out of all of
 *  them, split first page · 11–100 · not yet seen. The market's biggest
 *  searches are the Google tab's *Your market*, never this figure. */
function GoogleTile(p: { google: GoogleReading | null; firstScan: string }): React.JSX.Element {
  const reading = p.google;
  const value = reading === null ? null : renderValue(reading.value, GOOGLE_LABEL);
  const of = reading === null ? null : renderValue(reading.of, GOOGLE_LABEL);
  const shown = value !== null && !value.isDash;
  const split = reading?.reading;
  return (
    <Tile
      label={copy(GOOGLE_LABEL)}
      testId="overview-tile-google"
      href={GOOGLE_HREF}
      figure={shown ? value.text : null}
      against={shown && of !== null && !of.isDash ? <Against>{copy("overview.search.tile.your-pages.of", { of: of.text })}</Against> : null}
      lines={
        shown
          ? [
              split?.kind === "pages"
                ? copy("overview.search.tile.your-pages.split", {
                    first: formatCount(split.firstPage),
                    further: formatCount(split.further),
                    unseen: formatCount(split.unseen),
                  })
                : null,
            ]
          : [value === null ? copy("unmeasured.undeterminable", { what: copy(GOOGLE_LABEL) }) : p.firstScan]
      }
    />
  );
}

/** AI: the tracked searches whose AI answers mention the site, out of
 *  those asked, and how many of them link it, with the change. */
function AiTile(p: { prompts: PromptsModel; firstScan: string }): React.JSX.Element {
  if (p.prompts.kind !== "measured") {
    return <Tile label={copy(AI_LABEL)} testId="overview-tile-ai" href={AI_HREF} figure={null} lines={[p.firstScan]} />;
  }
  const { asked, mentioned, linked } = aiSearchesOf(p.prompts.prompts);
  const previous = p.prompts.previous;
  return (
    <Tile
      label={copy(AI_LABEL)}
      testId="overview-tile-ai"
      href={AI_HREF}
      figure={formatCount(mentioned.length)}
      against={<Against>{copy("overview.search.tile.searches.of", { of: formatCount(asked.length) })}</Against>}
      change={changeLine(previous === null ? undefined : mentioned.length - previous.mentioned)}
      lines={[copy("overview.tile.ai.line"), copy("overview.tile.ai.linked", { linked: formatCount(linked.length) })]}
    />
  );
}

/** Issue 1553: how many live pages reached each step toward being found,
 *  in the ladder's order, on one line. A step no page can be read on is
 *  left out; `null` where none can. */
function foundLine(found: ContentModel["found"]): string | null {
  if (found === null) return null;
  const steps = [
    found.crawled === null ? null : copy("overview.tile.content.crawled", { count: formatCount(found.crawled) }),
    found.indexed === null ? null : copy("overview.tile.content.indexed", { count: formatCount(found.indexed) }),
    found.impressions === null ? null : copy("overview.tile.content.impressions", { count: formatCount(found.impressions) }),
    found.bestPlace === null ? null : copy("overview.tile.content.place", { place: formatCount(found.bestPlace) }),
    found.cited === null ? null : copy("overview.tile.content.cited", { count: formatCount(found.cited) }),
  ].filter((step): step is string => step !== null);
  return steps.length === 0 ? null : steps.join(" · ");
}

/** Content: the pages published, how far they have got toward being found,
 *  those in the last four weeks, the last one and when the next goes
 *  live. */
function ContentTile(p: { content: ContentModel | null; nextAt: Date | null; timeZone: string }): React.JSX.Element {
  const next = p.nextAt === null ? null : copy("overview.tile.content.next", { on: formatDate(p.nextAt, p.timeZone) });
  if (p.content === null) {
    return (
      <Tile
        label={copy(CONTENT_LABEL)}
        testId="overview-tile-content"
        href={CONTENT_HREF}
        figure={null}
        lines={[copy("unmeasured.undeterminable", { what: copy(CONTENT_LABEL) }), next]}
      />
    );
  }
  const { pages, recent, last, found } = p.content;
  return (
    <Tile
      label={copy(CONTENT_LABEL)}
      testId="overview-tile-content"
      href={CONTENT_HREF}
      figure={formatCount(pages.length)}
      against={<Against>{copy("overview.tile.content.of")}</Against>}
      lines={[
        foundLine(found),
        copy("overview.tile.content.recent", {
          recent: formatCount(recent.length),
          weeks: formatCount(CONTENT_RECENT_WEEKS),
        }),
        last === null ? null : copy("overview.tile.content.last", { title: last.title, on: formatDate(last.publishedAt, p.timeZone) }),
        next,
      ]}
    />
  );
}
