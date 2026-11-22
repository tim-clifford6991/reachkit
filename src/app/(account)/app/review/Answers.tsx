// A site's AI answers on the owner's review: each tracked-prompt answer of its newest weekly pass, counted or not, and
// the one opened, read from the ledger when it is opened.
import type React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { PromptEngine } from "@/lib/scan/report";
import type { Guard, OpenedAnswer, SiteAnswers } from "./answers";

const ENGINE: Record<PromptEngine, CopyKey> = { ai_mode: "review.answers.engine.ai_mode", chatgpt: "review.answers.engine.chatgpt" };
const GUARD: Record<Guard, CopyKey> = {
  same_name: "review.answer.guard.same_name",
  missing_link: "review.answer.guard.missing_link",
  cited_host: "review.answer.guard.cited_host",
};
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MUTED = "text-sm text-base-content/70";

function Counted(p: { counted: boolean }): React.JSX.Element {
  return <span className={`badge badge-soft badge-sm ${p.counted ? "badge-success" : ""}`}>{copy(p.counted ? "review.answers.counted" : "review.answers.uncounted")}</span>;
}

function Opened(p: { answer: OpenedAnswer; close: string }): React.JSX.Element {
  const { answer } = p;
  const searched = answer.engine !== "chatgpt" ? null : copy(answer.searched === null ? "review.answer.searched.unknown" : answer.searched ? "review.answer.searched.yes" : "review.answer.searched.no");
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="review-answer">
      <div className="card-body min-w-0 gap-2 p-3 text-sm">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="card-title text-base break-words">{answer.question}</h2>
          <Link href={p.close} className="btn btn-ghost btn-sm btn-square" aria-label={copy("review.answer.close")}>
            <X aria-hidden className="size-4" />
          </Link>
        </div>
        <p className={MUTED}>
          {`${copy(ENGINE[answer.engine])} · ${DAY.format(new Date(`${answer.day}T00:00:00.000Z`))}`}
          {answer.model === null ? null : ` · ${copy("review.answer.model", { model: answer.model })}`}
        </p>
        <Counted counted={answer.counted} />
        {answer.counted ? null : <p>{copy(answer.guard === null ? "review.answer.guard.none" : GUARD[answer.guard])}</p>}
        {answer.excerpt === null ? (
          <p className={MUTED}>{copy("review.answer.missing")}</p>
        ) : (
          <blockquote className="border-s-2 border-base-300 ps-3 break-words">
            {answer.excerpt.before}
            {answer.excerpt.match === "" ? null : <mark>{answer.excerpt.match}</mark>}
            {answer.excerpt.after}
          </blockquote>
        )}
        {searched === null ? null : <p>{searched}</p>}
        <h3 className="font-semibold">{copy("review.answer.cited")}</h3>
        {answer.cited.length === 0 ? (
          <p className={MUTED}>{copy("review.answer.cited.none")}</p>
        ) : (
          <ul className="min-w-0 list-disc ps-5">
            {answer.cited.map((url) => (
              <li key={url} className="font-mono break-all">
                {url}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** `href` builds the address that opens the `n`th answer, or closes the open one at `null`. */
export function Answers(p: { read: SiteAnswers | null; opened: OpenedAnswer | null; href: (n: number | null) => string }): React.JSX.Element {
  if (p.read === null || p.read.items.length === 0) return <p className={MUTED}>{copy("review.answers.empty")}</p>;
  return (
    <>
      {p.opened === null ? null : <Opened answer={p.opened} close={p.href(null)} />}
      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body min-w-0 p-3">
          <ul className="list min-w-0" data-testid="review-answers">
            {p.read.items.map((item, n) => (
              <li key={n} className="list-row items-baseline">
                <Link href={p.href(n)} className="list-col-grow link link-hover min-w-0 break-words">
                  {item.question}
                </Link>
                <span className={MUTED}>{`${copy(ENGINE[item.engine])} · ${copy("review.answers.run", { n: String(item.run) })}`}</span>
                <Counted counted={item.counted} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
