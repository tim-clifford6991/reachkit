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
import { formatCount, renderValue } from "./present";
import type { BlogReadsModel } from "./blog-reads-model";

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
      <span className="min-w-0 text-xs font-semibold tracking-wide uppercase text-base-content/60">
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

export function BlogReads(p: { model: BlogReadsModel }): React.JSX.Element | null {
  if (!p.model.show) return null;

  const fetches = renderValue(p.model.fetches, FETCHES_LABEL);
  const referrals = renderValue(p.model.referrals, REFERRALS_LABEL);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="blog-reads">
      <div className="card-body min-w-0 gap-3 p-4">
        <header className="flex min-w-0 flex-col gap-1">
          <h2 className="card-title text-base!" data-testid="blog-reads-title">
            {copy("overview.blog.title")}
          </h2>
          <p className="text-xs text-base-content/60">
            {copy("overview.blog.lead", { days: formatCount(p.model.windowDays) })}
          </p>
        </header>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Figure
            labelKey={FETCHES_LABEL}
            testId="blog-reads-fetches"
            figure={
              fetches.isDash ? null : (
                <span className="num text-3xl leading-none font-bold" data-testid="blog-reads-fetches-value">
                  {fetches.text}
                </span>
              )
            }
            line={fetches.line ?? null}
          >
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
                    <span className="num text-end text-sm text-base-content/60">
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
                <span
                  className="num text-3xl leading-none font-bold"
                  data-testid="blog-reads-referrals-value"
                >
                  {copy("overview.blog.at-least", { n: referrals.text })}
                </span>
              )
            }
            line={referrals.line ?? null}
          >
            {referrals.isDash ? null : (
              <p className="mt-2 text-xs text-base-content/60">{copy("overview.blog.at-least.means")}</p>
            )}
          </Figure>
        </div>
      </div>
    </section>
  );
}
