// SPEC §4 (board AppAI) — the AI tab's parts below its head: three tiles,
// each page in AI answers, which AI read and sent visits, and the reputation
// card that closes on the grid of the twelve.
//
// **A figure nothing measured says "not measured"**, never 0 (REQ-004): a
// site whose pages ReachKit does not host keeps no server logs (X2), so its
// reads and visits cannot be counted. A hosted site with no visit yet leaves
// the visits tile out, as the board's state does.
import type React from "react";
import Link from "next/link";
import { ANSWER_RATE_WEEKS, MENTION_RATE_MIN_WEEKS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import type { BlogEngine } from "@/lib/publish/reads/classify";
import type { BlogReadsModel } from "@/lib/publish/reads/model";
import { ReadsBars } from "@/ui/charts/ReadsBars";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { shortDay } from "./Figures";
import { Legend, Mark } from "./AnswerGrid";
import { MARK_COPY_KEY } from "./answers-words";
import type { AnswerMark } from "./answers-model";
import type { AiPageRow, AiPages } from "./ai-pages";
import { CLOSED, TILE_GRID, formatCount } from "./present";
import { percent, type PromptsModel } from "./prompts-model";
import { NOT_MEASURED, Tile, type TileText } from "./SearchTiles";

const INK = "text-base-content/70";
const CARD = "card card-border min-w-0 bg-base-100";
const SHOWN = 6;
const READS_CHART = copy("overview.ai.reads.chart");
const VISITS_CHART = copy("overview.answers.visits.chart");

const BLOG_ENGINE: Readonly<Record<BlogEngine, CopyKey>> = Object.freeze({
  chatgpt: "ai-answers.engine.chatgpt",
  perplexity: "overview.blog.engine.perplexity",
  claude: "overview.blog.engine.claude",
  gemini: "overview.blog.engine.gemini",
  copilot: "overview.blog.engine.copilot",
});

/** The board's order of a page's engines: the two asked directly, then the Overview. */
const PAGE_ENGINES = [
  { engine: "chatgpt", index: 2 },
  { engine: "ai_mode", index: 1 },
  { engine: "ai_overview", index: 0 },
] as const;

/** Counted reads and visits, or `null` where none can be (no hosted page, or the counts could not be read). */
function countedReads(reads: BlogReadsModel): { fetches: number; referrals: number } | null {
  if (!reads.show || reads.fetches.kind === "unmeasured" || reads.referrals.kind === "unmeasured") return null;
  return { fetches: reads.fetches.value, referrals: reads.referrals.value };
}

function spark(reads: BlogReadsModel, pick: "fetches" | "referrals", label: string): React.ReactNode {
  if (reads.weekly.length < 2) return null;
  return (
    <ReadsBars
      label={label}
      weeks={reads.weekly.map((week) => ({ name: shortDay(new Date(`${week.start}T12:00:00Z`), "UTC"), count: week[pick] }))}
    />
  );
}

export function AiTiles(p: { pages: AiPages | null; reads: BlogReadsModel }): React.JSX.Element {
  const { pages } = p;
  const counted = countedReads(p.reads);
  const tiles: TileText[] = [
    {
      testId: "ai-tile-linked",
      label: copy("overview.answers.pages-cited.label"),
      means: copy("overview.answers.pages-cited.means"),
      ...(pages === null
        ? { ...NOT_MEASURED, split: copy("overview.answers.pages-cited.none") }
        : {
            figure: formatCount(pages.linked),
            quiet: pages.linked === 0,
            against: copy("overview.answers.pages-cited.of", { of: formatCount(pages.asked) }),
            spark: pages.asked === 0 ? null : <progress className="progress progress-primary w-full" value={pages.linked} max={pages.asked} aria-hidden />,
            split: [
              copy("overview.answers.linked.line"),
              ...(pages.mentioned === 0
                ? []
                : [pages.mentioned === 1 ? copy("overview.answers.linked.mentioned.one") : copy("overview.answers.linked.mentioned", { n: formatCount(pages.mentioned) })]),
            ].join(" "),
          }),
    },
    {
      testId: "ai-tile-reads",
      label: copy("overview.answers.reads.label"),
      means: copy("overview.answers.reads.means"),
      ...(counted === null
        ? NOT_MEASURED
        : {
            figure: formatCount(counted.fetches),
            quiet: counted.fetches === 0,
            against: copy("overview.answers.reads.of"),
            split: null,
            spark: spark(p.reads, "fetches", READS_CHART),
          }),
    },
  ];
  // No visit yet: the tile waits for the first one, and reads still show.
  if (counted === null || counted.referrals > 0) {
    tiles.push({
      testId: "ai-tile-visits",
      label: copy("overview.answers.visits.label"),
      means: copy("overview.answers.visits.means"),
      ...(counted === null
        ? NOT_MEASURED
        : {
            figure: formatCount(counted.referrals),
            quiet: false,
            against: copy("overview.answers.visits.of"),
            split: null,
            spark: spark(p.reads, "referrals", VISITS_CHART),
          }),
    });
  }
  return (
    <div className={`grid min-w-0 gap-4 ${TILE_GRID.answers}`} data-testid="ai-tiles">
      {tiles.map((tile) => (
        <Tile key={tile.testId} {...tile} />
      ))}
    </div>
  );
}

function engineWord(engine: (typeof PAGE_ENGINES)[number]["engine"], mark: AnswerMark): string {
  // An AI Overview Google did not show is the search's own fact, not an unanswered question.
  return copy(engine === "ai_overview" && mark === "no_answer" ? "overview.answers.engine.none" : MARK_COPY_KEY[mark]);
}

function PageRow(p: { row: AiPageRow }): React.JSX.Element {
  const { row } = p;
  const pair =
    row.question === null
      ? null
      : renderQuestion({ wording: row.question.wording, provenance: copy("overview.answers.from", { search: row.question.search }) });
  return (
    <li className="flex min-w-0 flex-col gap-2 border-t border-base-300 py-3" data-testid="ai-page">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {row.href === null ? (
            <span className="font-semibold">{row.title}</span>
          ) : (
            <Link className="link link-hover font-semibold" href={row.href} prefetch={false}>
              {row.title}
            </Link>
          )}
          {pair === null ? null : (
            <p className={`text-xs ${INK}`}>
              <span className="font-mono">{pair[0].text}</span> <span>{pair[1].text}</span>
            </p>
          )}
        </div>
        <span className="flex items-center gap-2 text-xs">
          <span className="flex gap-1" aria-hidden>
            {row.dots.map((dot) => (
              <span key={dot.name} aria-hidden className={`size-2 rounded-full ${dot.reached ? "bg-primary" : "bg-base-300"}`} />
            ))}
          </span>
          <span data-testid="ai-page-step">{row.step === null ? copy("overview.answers.pages.unread") : copy(row.step)}</span>
        </span>
      </div>
      {row.question === null ? null : (
        <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-1" aria-label={copy("overview.answers.pages.engines")}>
          {PAGE_ENGINES.map(({ engine, index }) => {
            const mark = row.question!.marks[index] ?? "not_measured";
            return (
              <li key={engine} className="flex min-w-0 items-center gap-1.5 text-xs" data-mark={mark}>
                <Mark mark={mark} />
                <span className={INK}>{copy(ENGINE_LABEL[engine])}</span>
                <span>{engineWord(engine, mark)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AiPagesCard(p: { pages: AiPages | null; place: string | null }): React.JSX.Element {
  const rows = p.pages?.rows ?? [];
  const used = rows.flatMap((row) => row.question?.marks ?? []);
  const list = (part: readonly AiPageRow[]) => (
    <ul className="flex min-w-0 flex-col">
      {part.map((row) => (
        <PageRow key={row.id} row={row} />
      ))}
    </ul>
  );
  return (
    <section className={CARD} aria-labelledby="ai-pages-title" data-testid="ai-pages">
      <div className="card-body min-w-0 gap-3 p-4 sm:p-5">
        <h2 id="ai-pages-title" className="text-lg font-semibold">
          {copy("overview.answers.pages.title")}
        </h2>
        <p className={`text-sm ${INK}`} data-testid="ai-pages-lead">
          {p.place === null ? copy("overview.answers.pages.lead.anywhere") : copy("overview.answers.pages.lead", { place: p.place })}
        </p>
        {rows.length === 0 ? (
          <p className={`text-sm ${INK}`} data-testid="ai-pages-none">
            {copy("overview.answers.pages-cited.none")}
          </p>
        ) : (
          <>
            <Legend used={used} />
            {list(rows.slice(0, SHOWN))}
            {rows.length <= SHOWN ? (
              <p className={`text-xs ${INK}`} data-testid="ai-pages-shown">
                {copy("overview.answers.pages.shown", { shown: formatCount(rows.length), total: formatCount(rows.length) })}
              </p>
            ) : (
              <details className="collapse min-w-0">
                <summary className="collapse-title flex min-h-0 min-w-0 flex-wrap justify-between gap-x-3 p-0 text-sm">
                  <span className={`text-xs ${INK}`} data-testid="ai-pages-shown">
                    {copy("overview.answers.pages.shown", { shown: formatCount(SHOWN), total: formatCount(rows.length) })}
                  </span>
                  <span className="link font-semibold">{copy("overview.search.show-all", { total: formatCount(rows.length) })}</span>
                </summary>
                <div className="collapse-content min-w-0 px-0">{list(rows.slice(SHOWN))}</div>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** One bar per name: its count, and a track as long as the largest. */
function Bars(p: { rows: readonly { name: string; count: number; own?: boolean }[]; label: string }): React.JSX.Element {
  const most = Math.max(1, ...p.rows.map((row) => row.count));
  return (
    <ul className="flex min-w-0 flex-col gap-2" aria-label={p.label}>
      {p.rows.map((row) => (
        <li key={row.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className={`min-w-0 text-sm break-words ${row.own === true ? "font-semibold" : ""}`}>{row.name}</span>
          <span className="num text-sm">{formatCount(row.count)}</span>
          <progress className={`progress col-span-full ${row.own === true ? "progress-primary" : ""}`} value={row.count} max={most} aria-hidden />
        </li>
      ))}
    </ul>
  );
}

/** Which engines read the pages and sent people, this week; hosted pages only. */
export function WhoReads(p: { reads: BlogReadsModel }): React.JSX.Element | null {
  const counted = countedReads(p.reads);
  if (counted === null) return null;
  const rows = (pick: "fetches" | "referrals") =>
    p.reads.byEngine.filter((row) => row[pick] > 0).map((row) => ({ name: copy(BLOG_ENGINE[row.engine]), count: row[pick] }));
  return (
    <details className={`${CARD} ${CLOSED.root}`} data-testid="ai-who">
      <summary className="collapse-title flex min-h-0 min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pe-10">
        <h2 className="text-base font-semibold">{copy("overview.answers.who.title")}</h2>
        <span className={`text-sm ${INK}`} data-testid="ai-who-sum">
          {copy("overview.answers.who.sum", { reads: formatCount(counted.fetches), visits: formatCount(counted.referrals) })}
        </span>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-2 px-4">
        <h3 className="font-semibold">{copy("overview.answers.who.reads")}</h3>
        <p className={`text-sm ${INK}`}>{copy("overview.answers.who.reads.means")}</p>
        <Bars rows={rows("fetches")} label={copy("overview.answers.who.reads")} />
        <h3 className="mt-2 font-semibold">{copy("overview.answers.visits.label")}</h3>
        <p className={`text-sm ${INK}`}>{copy("overview.answers.who.visits.means")}</p>
        <Bars rows={rows("referrals")} label={copy("overview.answers.visits.label")} />
      </div>
    </details>
  );
}

const QUESTIONS_SHOWN = 3;

/** How often AI mentions the business over the month's window — Overview's
 *  own reading — closing on the grid of the twelve. */
export function Reputation(p: { model: PromptsModel; children: React.ReactNode }): React.JSX.Element | null {
  if (p.model.kind !== "measured") return null;
  const { rate, rateShown, firstMeasurement } = p.model;
  const n = formatCount(rate.linked + rate.named);
  const m = formatCount(rate.samples);
  const weeks = formatCount(ANSWER_RATE_WEEKS);
  const asked = p.model.prompts.filter((prompt) => prompt.kind !== "branded");
  const you = copy("overview.prompts.share.you");
  return (
    <details className={`${CARD} ${CLOSED.root}`} data-testid="ai-reputation">
      <summary className="collapse-title flex min-h-0 min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pe-10">
        <h2 className="text-base font-semibold">{copy("overview.prompts.rate.title")}</h2>
        <span className="text-base" data-testid="ai-reputation-count">
          {copy("overview.prompts.rate.count", { n, m, weeks })}
        </span>
        <span className={`text-sm ${INK}`}>{copy(firstMeasurement ? "overview.prompts.rate.first" : "overview.prompts.rate.monthly")}</span>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-3 px-4">
        <p className="max-w-prose text-sm">{copy("overview.prompts.rate.reputation")}</p>
        <p className="max-w-prose text-sm" data-testid="ai-reputation-band">
          {rateShown
            ? copy("overview.prompts.rate.band", { n, m, weeks, low: formatCount(percent(rate.low)), high: formatCount(percent(rate.high)) })
            : copy(firstMeasurement ? "overview.tile.mention-rate.first" : "overview.tile.mention-rate.early", { weeks: formatCount(MENTION_RATE_MIN_WEEKS) })}
        </p>
        <h3 className="font-semibold">{copy("overview.prompts.share.title")}</h3>
        {p.model.shareOfVoice === null ? (
          <p className={`text-sm ${INK}`}>{copy("overview.prompts.share.none")}</p>
        ) : (
          <>
            <p className={`text-sm ${INK}`}>{copy("overview.prompts.share.lead", { m })}</p>
            <Bars
              label={copy("overview.prompts.share.label")}
              rows={[
                { name: you, count: rate.linked + rate.named, own: true },
                ...p.model.rivals.map((rival) => ({ name: rival.domain, count: rival.answers })),
              ]}
            />
          </>
        )}
        <h3 className="font-semibold">{copy("overview.prompts.list.title")}</h3>
        <ul className="flex min-w-0 list-disc flex-col gap-1 ps-5 text-sm">
          {asked.slice(0, QUESTIONS_SHOWN).map((prompt) => (
            <li key={prompt.id}>{prompt.text}</li>
          ))}
        </ul>
        <p className={`text-sm ${INK}`}>
          {copy("overview.prompts.list.count", {
            n: formatCount(Math.min(QUESTIONS_SHOWN, asked.length)),
            m: formatCount(asked.length),
          })}
        </p>
        {p.children}
      </div>
    </details>
  );
}
