// SPEC §6 (2026-09-20, #908) measure (d) — *AI engines on your blog*.
//
// "On hosted blogs only: pages fetched by an answer engine for a user's
// question, and visitors arriving from one, counted by day, page and
// engine, shown as 'at least'. Training crawlers are not progress and are
// not shown."
//
// **Two figures, never one.** A fetch is an engine reading the page; a
// referral is a person arriving. They sit side by side and are never added,
// because a sum of the two would present robots as an audience.
//
// **The referral figure is always "at least".** §6(d)'s own word, and the
// line under it says why: most AI apps send neither a referrer nor a tagged
// link, so the count is a floor and never a measurement of how many people
// an answer sent.
//
// **Every number goes through `renderValue`**, so counts nobody could read
// are the dash and their own written line rather than a card of zeroes.
//
// **It is not drawn at all for a site with no hosted page.** A WordPress
// customer's visitors reach a server this product does not own, and a
// hosted blog with nothing published yet has nothing for an engine to have
// fetched — in both cases two zeroes would be a claim about engines rather
// than a fact about the record.
//
// **daisyUI in the route** (DESIGN rule 1): `card` for the box and `list` /
// `list-row` for the engine rows — the grid is the `list-row`'s own, so no
// class of ours lays it out. Counts are `num`; the engine names and the two
// figure names wrap rather than clamp, because a number is never clamped
// and a two-word name cut in half is a name nobody can read.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { BlogEngine } from "@/lib/publish/reads/classify";
import { CLOSED, formatCount, renderValue } from "./present";
import type { BlogReadsModel } from "@/lib/publish/reads/model";

const FETCHES_LABEL = "overview.blog.fetches.label" satisfies CopyKey;
const REFERRALS_LABEL = "overview.blog.referrals.label" satisfies CopyKey;

/** One word per engine, total over the pin — so a sixth engine is a compile
 *  error here rather than a row with no name. ChatGPT is the report
 *  screen's own key; a second spelling of it would be the second place the
 *  product speaks. */
const ENGINE_LABEL: Readonly<Record<BlogEngine, CopyKey>> = Object.freeze({
  chatgpt: "ai-answers.engine.chatgpt",
  perplexity: "overview.blog.engine.perplexity",
  claude: "overview.blog.engine.claude",
  gemini: "overview.blog.engine.gemini",
  copilot: "overview.blog.engine.copilot",
});

/** One reading: its name, the figure, and the lines under it. The same
 *  shape `AnswerTiles` draws, because these are the same kind of reading —
 *  but its own function, not a shared one: that file's tiles carry a
 *  denominator and a goal, and these two carry neither. */
function Figure(p: {
  labelKey: CopyKey;
  testId: string;
  figure: React.ReactNode | null;
  line: string | null;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0" data-testid={p.testId}>
      <span className="min-w-0 text-xs font-semibold tracking-wide uppercase text-base-content/70">
        {copy(p.labelKey)}
      </span>
      {p.figure === null ? (
        <p className="mt-1 text-sm text-base-content/70">{p.line ?? copy(p.labelKey)}</p>
      ) : (
        <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-2">{p.figure}</p>
      )}
      {p.children}
    </div>
  );
}

/** The fetch figure's change on the window before it (SPEC §4, 2026-10-09,
 *  issue 1364), written once for this card and the Overview's tile. `null`
 *  where either window has no figure: a change is two counts, and one
 *  nobody stored is not a zero. */
export function fetchChangeLine(model: BlogReadsModel): string | null {
  if (model.fetches.kind === "unmeasured" || model.previousFetches === null) return null;
  const days = formatCount(model.windowDays);
  const change = model.fetches.value - model.previousFetches;
  if (change === 0) return copy("overview.blog.change.same", { days });
  return copy(change > 0 ? "overview.blog.change.up" : "overview.blog.change.down", {
    count: formatCount(Math.abs(change)),
    days,
  });
}

export function BlogReads(p: { model: BlogReadsModel }): React.JSX.Element | null {
  if (!p.model.show) return null;

  const fetches = renderValue(p.model.fetches, FETCHES_LABEL);
  const referrals = renderValue(p.model.referrals, REFERRALS_LABEL);
  const change = fetchChangeLine(p.model);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="blog-reads">
      <div className="card-body min-w-0 gap-3 p-4">
        {/* What the card counts, closed under its own name (SPEC §4,
            2026-10-07, issue 1324). */}
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className="card-title text-base!" data-testid="blog-reads-title">
              {copy("overview.blog.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <p className="text-xs text-base-content/70">
              {copy("overview.blog.lead", { days: formatCount(p.model.windowDays) })}
            </p>
          </div>
        </details>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Figure
            labelKey={FETCHES_LABEL}
            testId="blog-reads-fetches"
            figure={
              fetches.isDash ? null : (
                <span className="figure text-3xl leading-none" data-testid="blog-reads-fetches-value">
                  {fetches.text}
                </span>
              )
            }
            line={fetches.line ?? null}
          >
            {change === null ? null : (
              <p className="mt-2 text-xs text-base-content/70" data-testid="blog-reads-change">
                {change}
              </p>
            )}
            {fetches.isDash ? null : (
              <ul className="list mt-2 min-w-0" aria-label={copy("overview.blog.engines.label")}>
                {p.model.byEngine.map((row) => (
                  <li key={row.engine} className="list-row min-w-0 px-0" data-testid={`blog-reads-engine-${row.engine}`}>
                    <span className="min-w-0 text-sm text-base-content/80">
                      {copy(ENGINE_LABEL[row.engine])}
                    </span>
                    {/* The `list-row` grid gives the second child the row's
                        remaining width; `text-end` is what puts the count at
                        its edge rather than beside the name. */}
                    <span className="num text-end text-sm text-base-content/70">
                      {formatCount(row.fetches)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Figure>

          <Figure
            labelKey={REFERRALS_LABEL}
            testId="blog-reads-referrals"
            figure={
              referrals.isDash ? null : (
                // `num-phrase`: this is the one figure on the screen that is
                // **a line of language rather than a value** — "at least 13",
                // not "13" — and `.num` alone is `white-space: nowrap`, so it
                // could never fold. At 200% text it ran 77px past the card
                // that holds it (WCAG 1.4.4 Resize text, #328). `type.css`
                // says the opt-in is the caller's judgement about what the
                // text is, and this text is a phrase; it still folds only at
                // its space, never inside the number.
                <span
                  className="figure num-phrase text-3xl leading-none"
                  data-testid="blog-reads-referrals-value"
                >
                  {copy("overview.blog.at-least", { n: referrals.text })}
                </span>
              )
            }
            line={referrals.line ?? null}
          >
            {referrals.isDash ? null : (
              <p className="mt-2 text-xs text-base-content/70">{copy("overview.blog.at-least.means")}</p>
            )}
          </Figure>
        </div>
      </div>
    </section>
  );
}
