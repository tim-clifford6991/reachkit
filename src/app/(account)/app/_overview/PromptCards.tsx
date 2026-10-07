// SPEC §4 (D22) · §6 (D19, #1162) — the AI answers tab's reading of the
// tracked buyer prompts: the mention rate with its range, share of voice,
// the site's own pages cited, and the prompts themselves.
//
// daisyUI cards, a `progress` per share row and plain lists. Every number
// has its denominator beside it. Nothing here states an AI position or
// sentiment, and nothing can overflow: every column is `min-w-0`, prompts
// and addresses wrap, and no figure is clamped.
import type React from "react";
import { ANSWER_RATE_WEEKS, MENTION_RATE_MIN_WEEKS } from "@/lib/config/constants";
import type { PromptKind } from "@/lib/market/prompts/generate";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount } from "./present";
import { percent, type PromptsModel } from "./prompts-model";

type Measured = Extract<PromptsModel, { kind: "measured" }>;

const KIND_LABEL: Readonly<Record<PromptKind, CopyKey>> = Object.freeze({
  category: "overview.prompts.kind.category",
  "use-case": "overview.prompts.kind.use-case",
  persona: "overview.prompts.kind.persona",
  comparison: "overview.prompts.kind.comparison",
  problem: "overview.prompts.kind.problem",
  branded: "overview.prompts.kind.branded",
});

const INK = "text-base-content/70";

function Card(p: { testId: string; title: string; lead: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <h2 className="card-title text-base!">{p.title}</h2>
        <p className={`max-w-prose text-sm ${INK}`}>{p.lead}</p>
        {p.children}
      </div>
    </section>
  );
}

/** The rate's own card: the figure, its range, the split and why the
 *  range is there. */
function RateCard(p: { model: Measured }): React.JSX.Element {
  const { rate, rateShown, firstMeasurement, branded } = p.model;
  const quiet = rate.linked + rate.named === 0;
  return (
    <section
      className={quiet ? "card min-w-0 bg-base-200" : "card card-border min-w-0 bg-base-100"}
      data-testid="prompts-rate"
    >
      <div className="card-body gap-2 p-4">
        <span className={`min-w-0 text-xs font-semibold tracking-wide uppercase ${INK}`}>
          {copy("overview.tile.mention-rate.label")}
        </span>
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span
            className={quiet ? `figure text-base leading-none ${INK}` : "figure text-3xl leading-none"}
            data-testid="prompts-rate-value"
          >
            {rateShown ? `${formatCount(percent(rate.rate))}%` : formatCount(rate.linked + rate.named)}
          </span>
          <span className={`num text-sm ${INK}`}>
            {rateShown
              ? copy("overview.tile.mention-rate.band", {
                  low: formatCount(percent(rate.low)),
                  high: formatCount(percent(rate.high)),
                })
              : copy("overview.tile.mention-rate.early.of", { answers: formatCount(rate.samples) })}
          </span>
        </div>
        <p className={`text-xs ${INK}`}>
          {rateShown
            ? copy("overview.tile.mention-rate.of", {
                mentioned: formatCount(rate.linked + rate.named),
                answers: formatCount(rate.samples),
                weeks: formatCount(ANSWER_RATE_WEEKS),
              })
            : copy(firstMeasurement ? "overview.tile.mention-rate.first" : "overview.tile.mention-rate.early", {
                weeks: formatCount(MENTION_RATE_MIN_WEEKS),
              })}
        </p>
        <p className={`text-xs ${INK}`}>
          {copy("overview.prompts.rate.split", {
            linked: formatCount(rate.linked),
            named: formatCount(rate.named),
          })}
        </p>
        {/* The sentence explains the range, so it waits for the rate. */}
        {rateShown ? (
          <p className={`max-w-prose text-xs ${INK}`}>
            {copy("overview.prompts.rate.means", {
              prompts: formatCount(p.model.prompts.filter((prompt) => prompt.kind !== "branded").length),
              weeks: formatCount(ANSWER_RATE_WEEKS),
              answers: formatCount(rate.samples),
            })}
          </p>
        ) : null}
        {branded === null ? null : (
          <p className={`max-w-prose text-xs ${INK}`} data-testid="prompts-branded">
            {copy("overview.prompts.branded", {
              mentioned: formatCount(branded.linked + branded.named),
              answers: formatCount(branded.samples),
            })}
          </p>
        )}
      </div>
    </section>
  );
}

/** The site beside its rivals, by answers that named each. */
function ShareCard(p: { model: Measured }): React.JSX.Element {
  const ours = p.model.rate.linked + p.model.rate.named;
  const rows = [
    { name: copy("overview.prompts.share.you"), answers: ours, own: true },
    ...p.model.rivals.map((rival) => ({ name: rival.domain, answers: rival.answers, own: false })),
  ];
  const most = Math.max(1, ...rows.map((row) => row.answers));
  return (
    <Card testId="prompts-share" title={copy("overview.prompts.share.title")} lead={copy("overview.prompts.share.lead")}>
      {p.model.shareOfVoice === null ? (
        <p className={`text-sm ${INK}`}>{copy("overview.prompts.share.none")}</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2" aria-label={copy("overview.prompts.share.label")}>
          {rows.map((row) => (
            <li key={row.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <span className={`min-w-0 text-sm break-words ${row.own ? "font-semibold" : "font-mono"}`}>{row.name}</span>
              <span className={`num text-xs ${INK}`}>
                {copy("overview.prompts.share.answers", { count: formatCount(row.answers) })}
              </span>
              <progress
                className={row.own ? "progress progress-primary col-span-full" : "progress col-span-full text-base-content/70"}
                value={row.answers}
                max={most}
                aria-label={row.name}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The site's own pages those answers linked to. */
function PagesCard(p: { model: Measured }): React.JSX.Element {
  return (
    <Card
      testId="prompts-pages"
      title={copy("overview.prompts.pages.title")}
      lead={copy("overview.prompts.pages.lead", { weeks: formatCount(ANSWER_RATE_WEEKS) })}
    >
      {p.model.pages.length === 0 ? (
        <p className={`text-sm ${INK}`}>{copy("overview.prompts.pages.none")}</p>
      ) : (
        <ul className="flex min-w-0 flex-col" aria-label={copy("overview.prompts.pages.label")}>
          {p.model.pages.map((page) => (
            <li
              key={page.url}
              className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-base-300 py-2"
            >
              <a href={page.url} className="link link-primary min-w-0 font-mono text-sm break-all">
                {page.label}
              </a>
              <span className={`num text-xs ${INK}`}>
                {copy("overview.prompts.share.answers", { count: formatCount(page.answers) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The set itself: each prompt, its kind and how its answers read. */
function ListCard(p: { model: Measured }): React.JSX.Element {
  return (
    <Card testId="prompts-list" title={copy("overview.prompts.list.title")} lead={copy("overview.prompts.list.lead")}>
      <ul className="flex min-w-0 flex-col" aria-label={copy("overview.prompts.list.label")}>
        {p.model.prompts.map((prompt) => (
          <li key={prompt.id} className="flex min-w-0 flex-col gap-1 border-t border-base-300 py-2" data-testid="prompts-row">
            <span className="min-w-0 text-sm">{prompt.text}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="badge badge-ghost badge-sm">{copy(KIND_LABEL[prompt.kind])}</span>
              <span className={`num text-xs ${INK}`}>
                {prompt.answers === 0
                  ? copy("overview.prompts.list.unanswered")
                  : copy("overview.prompts.list.named", {
                      mentioned: formatCount(prompt.mentioned),
                      answers: formatCount(prompt.answers),
                    })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PromptCards(p: { model: PromptsModel }): React.JSX.Element | null {
  if (p.model.kind !== "measured") return null;
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="prompts-cards">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <RateCard model={p.model} />
        <ShareCard model={p.model} />
      </div>
      <PagesCard model={p.model} />
      <ListCard model={p.model} />
    </div>
  );
}
