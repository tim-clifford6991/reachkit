// SPEC §6 (2026-09-20, #908) — the twelve questions against the three
// answer engines.
//
// "The question × engine grid, as CSS grid and not a chart": docs/DESIGN.md
// rule 2 — "grids that are not series (rivals × questions, week strip) are
// CSS grid" — so this is a `grid` with `role="table"` over it, exactly as
// the free report's own matrix has been since #730, and not a Recharts
// series and not hand-rolled SVG.
//
// **Every mark is readable three ways, and never by colour alone**
// (docs/DESIGN.md, §2.4): a lucide glyph that differs per mark, an
// `aria-label` naming the question, the engine and what that engine said,
// and a written legend above the grid. Two of the five marks share a colour
// — links and names are both the customer — and their glyphs are what tells
// them apart, which is the point of not painting meaning.
//
// **The wording is model text.** It reaches this file only through
// `renderQuestion`, which will not yield it without the search it was
// phrased from (REQ-093 c3), and both halves of that pair are drawn.
//
// **One grid, two shapes, and no value is ever cut off.** Above `sm` it is
// four columns: the question, capped at a readable measure so the marks do
// not drift a screen away from it on a wide monitor, then one per engine
// sharing what is left, with the engine names as column heads. Below `sm` the same grid falls to a single column — the
// head row is `hidden`, and each mark takes a full-width line that carries
// its engine's name beside it. That is docs/DESIGN.md's own rule for a
// chart read for a grid ("a bar gets its own full-width line under its
// label, never the space left beside one"), and it is why nothing here sits
// in a horizontal scroller: a mark hidden off the right edge of a scroller
// is a mark a phone never shows, and every cell on this grid has to be
// readable. Nothing is clamped either — a question wraps and its row grows,
// which is the box changing rather than the value.
//
// **The published pages' own questions are rows of this grid** (SPEC §6
// 2026-09-20, #919), beneath the twelve and in the same shape: they are
// tracked questions, asked of the same three engines in the same pass, and
// a second grid for them would be the same picture twice. What keeps them
// apart is arithmetic and not a component — the four-week rate and this
// week's n of 12 count the twelve alone (`answers-model.ts`), and the line
// under the title states how many questions are tracked in all against the
// cap they obey.
//
// **Two things on the approved board are deliberately not here**: *Also
// appearing for* and the cited-pages tile (#920, after the pilot), and the
// hosted-blog engine counts (#921). Each is a card of its own beneath this
// one when its issue lands; neither stands here as a placeholder.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { formatCount } from "./present";
import { PAGE_QUESTION_RETIRE_WEEKS } from "@/lib/config/constants";
import { ANSWER_MARKS, type AnswerMark, type AnswerQuestion, type AnswersModel } from "./answers-model";
import { MARK_COPY_KEY, MARK_ICON, MARK_TONE } from "./answers-words";

/** One mark, drawn. `aria-hidden` on the glyph: the cell around it carries
 *  the written name, and a glyph with a name of its own would be read
 *  twice. */
function Mark(p: { mark: AnswerMark }): React.JSX.Element {
  const Glyph = MARK_ICON[p.mark];
  return (
    <Glyph size={16} strokeWidth={1.75} aria-hidden className={`shrink-0 ${MARK_TONE[p.mark]}`} />
  );
}

/** The legend, above the grid: every mark the grid can draw, with its word.
 *  All five always — a legend that shrank to the marks on screen would stop
 *  explaining the grid the week one of them disappeared. */
function Legend(): React.JSX.Element {
  return (
    <ul
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
      aria-label={copy("overview.answers.legend.label")}
      data-testid="answers-legend"
    >
      {ANSWER_MARKS.map((mark) => (
        <li key={mark} className="flex min-w-0 items-center gap-1.5 text-xs text-base-content/70">
          <Mark mark={mark} />
          {copy(MARK_COPY_KEY[mark])}
        </li>
      ))}
    </ul>
  );
}

/** One question's row: its number and wording, the search it was phrased
 *  from, the page ReachKit published for that search where there is one,
 *  and one cell per engine. */
function Row(p: { question: AnswerQuestion; engines: AnswersModel["engines"] }): React.JSX.Element {
  const [wording, provenance] = renderQuestion({
    wording: p.question.wording,
    provenance: copy("overview.answers.from", { search: p.question.search }),
  });
  const page = p.question.page;

  return (
    // The row is a **subgrid**, not `display: contents`. A `contents`
    // element generates no box, so every cell inside one measures as
    // escaping a parent that is 0×0 at the origin — which is what
    // `tests/ui/layout/checks.ts`'s containment check reports, forty-eight
    // times over, and it is right to. A subgrid row has a real box and its
    // children still sit in the parent's own columns.
    <div
      role="row"
      className="col-span-full grid grid-cols-subgrid border-t border-base-300"
      data-testid="answers-row"
    >
      <div
        role="rowheader"
        className="flex min-w-0 flex-col gap-0.5 pt-3 pb-1 pr-2 sm:py-2"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="num shrink-0 text-xs text-base-content/70">
            {formatCount(p.question.n)}
          </span>
          {/* The UI face, not the mono one: a question is a sentence, and
              docs/DESIGN.md reserves JetBrains Mono for numerals, domains
              and code. It wraps rather than being clamped — the row grows,
              which is the box changing instead of the value. */}
          <span className="min-w-0 text-sm font-semibold">{wording.text}</span>
        </span>
        <span className="min-w-0 text-xs text-base-content/70">{provenance.text}</span>
        {page === null ? null : (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-base-content/70">{copy("overview.answers.page")}</span>
            <a
              href={page.url}
              className="link link-primary min-w-0 text-xs"
              data-testid="answers-page"
            >
              {page.title}
            </a>
          </span>
        )}
      </div>
      {p.engines.map((engine, i) => {
        const mark = p.question.marks[i] ?? "not_measured";
        return (
          <div
            key={engine}
            role="cell"
            data-mark={mark}
            className="flex min-w-0 items-center gap-2 py-1 pl-6 sm:justify-center sm:py-2 sm:pl-0"
            aria-label={copy("overview.answers.cell", {
              question: wording.text,
              engine: copy(ENGINE_LABEL[engine]),
              mark: copy(MARK_COPY_KEY[mark]),
            })}
          >
            <Mark mark={mark} />
            {/* The engine's name, on the phone shape only: above `sm` the
                column head above the cell already names it, and a name in
                both places would be the same word twice down every row. */}
            <span className="min-w-0 text-xs text-base-content/60 sm:hidden">
              {copy(ENGINE_LABEL[engine])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AnswerGrid(p: { model: AnswersModel }): React.JSX.Element {
  if (p.model.questions.length === 0) {
    return (
      <section className="card card-border min-w-0 bg-base-100" data-testid="answers-grid">
        <div className="card-body p-5">
          <h2 className="card-title text-base!">{copy("overview.answers.grid.title")}</h2>
          <p className="max-w-prose text-sm text-base-content/70">{copy("overview.answers.empty")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="answers-grid">
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <h2 className="card-title text-base!">{copy("overview.answers.grid.title")}</h2>
        <p className="max-w-prose text-sm text-base-content/70">
          {copy("overview.answers.grid.lead", { of: formatCount(p.model.questions.length) })}
        </p>
        <p className="max-w-prose text-xs text-base-content/70" data-testid="answers-tracked">
          {copy("overview.answers.grid.tracked", {
            tracked: formatCount(p.model.tracked),
            max: formatCount(p.model.cap),
            weeks: formatCount(PAGE_QUESTION_RETIRE_WEEKS),
          })}
        </p>
        <Legend />

        <div
          role="table"
          aria-label={copy("overview.answers.grid.label")}
          className="grid min-w-0 grid-cols-1 items-center sm:grid-cols-[minmax(0,40rem)_repeat(3,minmax(5.5rem,1fr))]"
        >
          {/* The column heads belong to the four-column shape. On the phone
              shape each cell names its own engine instead, so this row is
              not drawn at all rather than drawn and ignored. */}
          <div role="row" className="hidden sm:col-span-full sm:grid sm:grid-cols-subgrid">
            <div aria-hidden />
            {p.model.engines.map((engine) => (
              <span
                key={engine}
                role="columnheader"
                className="px-1 pb-1 text-center text-(length:--t-eyebrow) leading-tight font-semibold tracking-wide uppercase text-base-content/60"
              >
                {copy(ENGINE_LABEL[engine])}
              </span>
            ))}
          </div>
          {[...p.model.questions, ...p.model.pageQuestions].map((question) => (
            <Row key={question.n} question={question} engines={p.model.engines} />
          ))}
        </div>
      </div>
    </section>
  );
}
