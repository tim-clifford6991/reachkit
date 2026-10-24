// SPEC §0 "Knowledge base" · §5 (2026-09-29, issue 1133) — what the pages
// were read to say about the business, each item with the page it was read
// from, and the five questions only the founder can answer.
//
// daisyUI `collapse`, `list`, `badge`, `input`, `btn`. A fold, as the board
// draws it. The read half has no controls: what a page says is corrected on
// the page. The answers are one form and one save.
"use client";

import type React from "react";
import { KNOWLEDGE_BASE } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  FOUNDER_QUESTIONS,
  KNOWLEDGE_LISTS,
  type FounderAnswers,
  type KnowledgeBase,
  type KnowledgeList,
  type KnowledgeSource,
} from "@/lib/site-profile/knowledge/types";
import { QUESTION_COPY } from "../../../setup/_setup/business";
import { saveFounderAnswersAction } from "../business-actions";
import { BUSINESS_ANSWER_FIELD } from "../panel-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";

const LIST_COPY = {
  audience: "settings.knowledge.audience",
  problems: "settings.knowledge.problems",
  proof: "settings.knowledge.proof",
  questions: "settings.knowledge.questions",
  integrations: "settings.knowledge.integrations",
  places: "settings.knowledge.places",
} as const satisfies Record<KnowledgeList, CopyKey>;

/** The path, or the host where the path is the root (`FactsPanel`'s own). */
function shortAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.host : parsed.pathname;
  } catch {
    return url;
  }
}

/** Where an item is from: its page, linked, or the founder. */
function Source(p: { source: KnowledgeSource }): React.JSX.Element {
  return p.source.kind === "founder" ? (
    <span className="badge badge-ghost badge-sm shrink-0">{copy("settings.knowledge.from-you")}</span>
  ) : (
    <a className="link link-hover min-w-0 font-mono break-all text-xs" href={p.source.url} target="_blank" rel="noreferrer">
      {shortAddress(p.source.url)}
    </a>
  );
}

const STACK = "flex min-w-0 flex-col gap-2";

function Group(p: { head: CopyKey; id: string; tone?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className={p.tone ?? STACK} data-testid={`knowledge-${p.id}`}>
      <h3 className="eyebrow">{copy(p.head)}</h3>
      <ul className="list min-w-0">{p.children}</ul>
    </section>
  );
}

/** Between a name and its prices, and between features: a mark, not a word. */
const SEP = " · ";
const OFFERINGS = { head: "settings.knowledge.offerings", id: "offerings" } as const;
const DIFFERENTIATORS = { head: "settings.knowledge.differentiators", id: "differentiators" } as const;
/** The board's four sit as wells in one grid; the rest stack after it. */
const WELLS = ["problems", "differentiators", "questions", "places"] as const;
const STACKED = ["offerings", "audience", "proof", "integrations"] as const;
const WELL = `${STACK} rounded-box bg-base-200 p-3`;

const ROW = "list-row min-w-0 flex-wrap items-start gap-2 px-0";

export function KnowledgePanel(p: { knowledge: KnowledgeBase; answers: FounderAnswers }): React.JSX.Element {
  const writer = useSetting();
  const base = p.knowledge;
  const nothingRead =
    base.offerings.length === 0 &&
    base.differentiators.length === 0 &&
    KNOWLEDGE_LISTS.every((name) => base[name].length === 0);

  function group(name: (typeof WELLS)[number] | (typeof STACKED)[number], tone?: string): React.ReactNode {
    if (name === "offerings") {
      return base.offerings.length === 0 ? null : (
        <Group {...OFFERINGS} key={name}>
          {base.offerings.map((offering) => (
            <li className={ROW} key={offering.name}>
              <div className="flex min-w-0 grow flex-col gap-1">
                <p className="min-w-0 font-medium wrap-anywhere">
                  {offering.name}
                  {offering.prices.length === 0 ? null : (
                    <span className="num font-normal">
                      {SEP}
                      {offering.prices.join(SEP)}
                    </span>
                  )}
                </p>
                {[...offering.features, ...offering.uses].length === 0 ? null : (
                  <p className="min-w-0 text-sm text-base-content/70 wrap-anywhere">
                    {[...offering.features, ...offering.uses].join(SEP)}
                  </p>
                )}
                <Source source={offering.source} />
              </div>
            </li>
          ))}
        </Group>
      );
    }
    if (name === "differentiators") {
      return base.differentiators.length === 0 ? null : (
        <Group {...DIFFERENTIATORS} tone={tone} key={name}>
          {base.differentiators.map((entry) => (
            <li className={ROW} key={entry.text}>
              <div className="flex min-w-0 grow flex-col gap-1">
                <p className="min-w-0 wrap-anywhere">{entry.text}</p>
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-base-content/70">
                  {entry.rival === null ? null : (
                    <span className="min-w-0 wrap-anywhere">
                      {copy("settings.knowledge.against", { rival: entry.rival })}
                    </span>
                  )}
                  <Source source={entry.source} />
                </span>
              </div>
            </li>
          ))}
        </Group>
      );
    }
    return base[name].length === 0 ? null : (
      <Group head={LIST_COPY[name]} id={name} tone={tone} key={name}>
        {base[name].map((item) => (
          <li className={ROW} key={item.text}>
            <div className="flex min-w-0 grow flex-col gap-1">
              <p className="min-w-0 wrap-anywhere">{item.text}</p>
              <Source source={item.source} />
            </div>
          </li>
        ))}
      </Group>
    );
  }

  const wells = WELLS.map((name) => group(name, WELL)).filter((node) => node !== null);

  return (
    <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid="settings-business-knowledge">
      <summary className="collapse-title font-semibold">{copy("settings.knowledge.title")}</summary>
      <div className="collapse-content flex min-w-0 flex-col gap-4">
        {writer.saved ? <span className={SAVED_BADGE_CLASS}>{copy("settings.answer.saved-badge")}</span> : null}
        <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.knowledge.lead")}</p>

        {nothingRead ? (
          <p className="text-sm wrap-anywhere" data-testid="knowledge-none">
            {copy("settings.knowledge.none")}
          </p>
        ) : null}

        {wells.length === 0 ? null : (
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2" data-layout="wells">
            {wells}
          </div>
        )}
        {STACKED.map((name) => group(name))}

        <form
          action={(form) => writer.press(saveFounderAnswersAction, form)}
          className="flex min-w-0 flex-col gap-4"
          data-testid="knowledge-answers"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-semibold">{copy("setup.business.questions")}</h3>
            <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.knowledge.things.lead")}</p>
          </div>
          <ol className="flex min-w-0 flex-col gap-3">
            {FOUNDER_QUESTIONS.map((question, at) => (
              <li key={question} className="min-w-0">
                {/* "Thing n" names the field; the question says what it is used for (the fifth is the byline). */}
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm text-base-content/70">{copy("settings.knowledge.thing", { n: String(at + 1) })}</span>
                  <span className="min-w-0 text-xs text-base-content/70 wrap-anywhere">{copy(QUESTION_COPY[question])}</span>
                  <input
                    name={`${BUSINESS_ANSWER_FIELD}${question}`}
                    className="input min-w-0 w-full"
                    maxLength={KNOWLEDGE_BASE.ANSWER_CHARS}
                    defaultValue={p.answers[question] ?? ""}
                  />
                </label>
              </li>
            ))}
          </ol>
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={writer.busy}>
              {copy("settings.save")}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
