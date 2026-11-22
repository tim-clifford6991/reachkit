// SPEC §4 (plate O3) — Linked by AI's detail below its head: one row per page
// question asked in the window, a mark per engine asked, the page it belongs
// to and who else the answer named. A table from `md`, one row per question
// on a phone. "AI rank position", sentiment and a share of voice are never shown.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { formatShortDay } from "../_shell/format";
import { AI_MARK, type AiMark } from "./ai-mark";
import type { AiQuestionRow, AiQuestions } from "./ai-pages";
import { rowClass } from "./frame";
import { formatCount } from "./present";
import { ShowAll } from "./ShowAll";

const INK = "text-base-content/70";
const LIST = new Intl.ListFormat("en", { type: "conjunction" });

/** The head's lead: the engines asked, and the answers that named the site without a link. */
export function aiLead(model: AiQuestions): string {
  const asked = copy("overview.ai.lead", { engines: LIST.format(model.engines.map((engine) => copy(ENGINE_LABEL[engine]))), weeks: formatCount(model.weeks) });
  if (model.mentioned === 0) return asked;
  const more = model.mentioned === 1 ? copy("overview.ai.lead.mentioned.one") : copy("overview.ai.lead.mentioned", { k: formatCount(model.mentioned) });
  return `${asked} ${more}`;
}

function Mark(p: { mark: AiMark }): React.JSX.Element {
  const { icon: Icon, key } = AI_MARK[p.mark];
  return (
    <span className="inline-flex items-center gap-1" data-mark={p.mark}>
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      {copy(key)}
    </span>
  );
}

function Question(p: { row: AiQuestionRow; timeZone: string }): React.JSX.Element {
  const from = copy("overview.ai.from", { search: p.row.search, date: formatShortDay(p.row.lastAsked, p.timeZone) });
  // The wording is shown only beside the search it came from.
  const pair = p.row.wording === null ? null : renderQuestion({ wording: p.row.wording, provenance: from });
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {pair === null ? null : <span className="line-clamp-2 font-semibold break-words">{pair[0].text}</span>}
      <span className={`font-mono text-xs break-words ${INK}`}>{pair === null ? from : pair[1].text}</span>
    </span>
  );
}

function Page(p: { row: AiQuestionRow }): React.JSX.Element {
  const { page } = p.row;
  return page.href === null ? (
    <span className="break-words">{page.title}</span>
  ) : (
    <Link className="link link-hover link-primary break-words" href={page.href} prefetch={false}>
      {page.title}
    </Link>
  );
}

/** Who else the latest answer named; a report from before rivals were kept says it was not recorded, never "no one". */
function Also(p: { rivals: AiQuestionRow["rivals"] }): React.JSX.Element {
  if (p.rivals === null)
    return (
      <span>
        <span aria-hidden>{copy("unmeasured.dash")}</span>
        <span className="sr-only">{copy("overview.ai.also.unrecorded.sr")}</span>
      </span>
    );
  return <span className="break-words">{p.rivals.length === 0 ? copy("overview.ai.also.none") : p.rivals.join(" · ")}</span>;
}

const markOf = (row: AiQuestionRow, engine: AnswerEngine): AiMark => row.marks[engine] ?? "unchecked";

export function AiQuestionsCard(p: { model: AiQuestions; all: boolean; timeZone: string }): React.JSX.Element {
  const { model, all, timeZone } = p;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="ai-questions">
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="table">
          <caption className="sr-only">{copy("overview.ai.caption")}</caption>
          <thead className="text-base-content/70">
            <tr>
              <th scope="col" className="w-[31%]">{copy("overview.ai.col.question")}</th>
              {model.engines.map((engine) => (
                <th key={engine} scope="col">{copy(ENGINE_LABEL[engine])}</th>
              ))}
              <th scope="col">{copy("overview.ai.col.page")}</th>
              <th scope="col">{copy("overview.ai.col.also")}</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, i) => (
              <tr key={row.page.id} className={rowClass(i, all, true)} data-testid="ai-question">
                <td>
                  <Question row={row} timeZone={timeZone} />
                </td>
                {model.engines.map((engine) => (
                  <td key={engine}>
                    <Mark mark={markOf(row, engine)} />
                  </td>
                ))}
                <td>
                  <Page row={row} />
                </td>
                <td>
                  <Also rivals={row.rivals} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list min-w-0 md:hidden" aria-label={copy("overview.ai.caption")}>
        {model.rows.map((row, i) => (
          <li key={row.page.id} className={`list-row min-w-0 ${rowClass(i, all)}`} data-testid="ai-question-card">
            <div className="flex min-w-0 flex-col gap-2">
              <Question row={row} timeZone={timeZone} />
              <ul className="flex min-w-0 flex-col gap-1 text-sm">
                {model.engines.map((engine) => (
                  <li key={engine} className="flex min-w-0 flex-wrap items-center gap-x-1">
                    <span>{copy("overview.ai.engine", { engine: copy(ENGINE_LABEL[engine]) })}</span>
                    <Mark mark={markOf(row, engine)} />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex min-w-0 justify-center p-3 empty:hidden">
        <Suspense fallback={null}>
          <ShowAll total={model.rows.length} label={copy("overview.detail.show-all.questions", { n: formatCount(model.rows.length) })} />
        </Suspense>
      </div>
    </section>
  );
}

/** No page's question asked yet: when the first one is. */
export function AiNone(p: { due: Date; timeZone: string }): React.JSX.Element {
  return (
    <p className={`max-w-prose ${INK}`} data-testid="ai-none">
      {copy("overview.ai.none", { date: formatShortDay(p.due, p.timeZone) })}
    </p>
  );
}
