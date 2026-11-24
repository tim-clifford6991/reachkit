// SPEC §4 *Your business*: "What We Read from Your Site" as one line per answer, each changed in its own dialog. The
// customer's corrections choose the next pass's searches and write the pages (`profileWithEdits`).
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { say } from "@/app/_toast/say";
import { KNOWLEDGE_BASE } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import type { BusinessList, BusinessProfile } from "@/lib/site-profile/business/types";
import { FOUNDER_QUESTIONS, type FounderAnswers, type KnowledgeBase } from "@/lib/site-profile/knowledge/types";
import { QUESTION_COPY } from "../../../setup/_setup/business";
import { writtenLine } from "../../_shell/written";
import { rewordBusinessJobAction, saveBusinessListAction, saveFounderAnswersAction } from "../business-actions";
import type { BusinessScreen, Line } from "../business-screen";
import { remeasureNowAction } from "../change-actions";
import { EditDialog, fromSetting, listChange, StagedList, TextField } from "../EditDialog";
import { CARD, CARD_BODY, CARD_FOOT, CARD_LEAD, CARD_TITLE, SOFT } from "../frame";
import { MARKET_REMEASURE_INITIAL, type MarketRemeasureState } from "../market-state";
import {
  BUSINESS_ANSWER_FIELD,
  BUSINESS_ITEM_FIELD,
  BUSINESS_JOB_FIELD,
  BUSINESS_LIST_FIELD,
  BUSINESS_REMOVED_FIELD,
} from "../panel-state";
import { SettingLine } from "./SettingRow";

/** A business list's dialog: its items, and Save writes what the customer left in one write. */
export function ListDialog(p: { list: BusinessList; label: string; items: readonly string[]; lead?: string | null }): React.JSX.Element {
  async function save(form: FormData): Promise<ReturnType<typeof fromSetting>> {
    const { added, removed } = listChange(form, BUSINESS_ITEM_FIELD, p.items);
    const out = new FormData();
    out.set(BUSINESS_LIST_FIELD, p.list);
    for (const item of added) out.append(BUSINESS_ITEM_FIELD, item);
    for (const item of removed) out.append(BUSINESS_REMOVED_FIELD, item);
    return fromSetting(await saveBusinessListAction(out));
  }
  return (
    <EditDialog label={p.label} lead={p.lead ?? copy("settings.business.lead")} testId={`business-dialog-${p.list}`} save={save}>
      <StagedList items={p.items} name={BUSINESS_ITEM_FIELD} addLabel={copy("settings.business.add.label", { group: p.label })} />
    </EditDialog>
  );
}

function shortAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.host : parsed.pathname;
  } catch {
    return url;
  }
}

/** What buyers ask, as read from the pages, and the five things only the founder knows, which it saves. */
function AsksDialog(p: { label: string; knowledge: KnowledgeBase; answers: FounderAnswers }): React.JSX.Element {
  return (
    <EditDialog
      label={p.label}
      lead={copy("settings.knowledge.lead")}
      testId="business-dialog-asks"
      save={async (form) => fromSetting(await saveFounderAnswersAction(form))}
    >
      <ul className="list min-w-0">
        {p.knowledge.questions.map((item) => (
          <li key={item.text} className="list-row flex min-w-0 flex-col items-start gap-1 px-0">
            <span className="min-w-0 wrap-anywhere">{item.text}</span>
            {item.source.kind === "founder" ? (
              <span className="badge badge-ghost badge-sm">{copy("settings.knowledge.from-you")}</span>
            ) : (
              <a className="link link-hover num min-w-0 break-all text-xs" href={item.source.url} target="_blank" rel="noreferrer">
                {shortAddress(item.source.url)}
              </a>
            )}
          </li>
        ))}
      </ul>
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-1 font-semibold">{copy("setup.business.questions")}</legend>
        <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.knowledge.things.lead")}</p>
        {FOUNDER_QUESTIONS.map((question) => (
          <label key={question} className="flex min-w-0 flex-col gap-1">
            <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere">{copy(QUESTION_COPY[question])}</span>
            <input
              name={`${BUSINESS_ANSWER_FIELD}${question}`}
              className="input w-full min-w-0"
              maxLength={KNOWLEDGE_BASE.ANSWER_CHARS}
              defaultValue={p.answers[question] ?? ""}
            />
          </label>
        ))}
      </fieldset>
    </EditDialog>
  );
}

/** The last read, and the bounded re-read `remeasureNowAction` owns; its progress is the status line's. */
function ReadAgain(p: { lastRead: string }): React.JSX.Element {
  const [answer, setAnswer] = useState<MarketRemeasureState>(MARKET_REMEASURE_INITIAL);
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);

  function readAgain(): void {
    start(async () => {
      setFailed(false);
      try {
        const next = await remeasureNowAction();
        if (next.answer === "started") {
          const started = writtenLine("settings.market.remeasuring");
          if (started !== null) say(started, "ok");
          setAnswer(MARKET_REMEASURE_INITIAL);
        } else setAnswer(next);
      } catch {
        setFailed(true);
      }
    });
  }
  const line = failed ? copy("settings.answer.could-not-ask") : answer.answer === "refused" ? answer.line : null;

  return (
    <div className={CARD_FOOT}>
      <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="business-read-line">
        {p.lastRead}
      </p>
      <button type="button" className={SOFT} disabled={busy} onClick={readAgain} data-testid="business-read-again">
        {busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <RefreshCw size={16} strokeWidth={1.75} aria-hidden />}
        {copy("settings.business.read-again")}
      </button>
      {line === null ? null : (
        <p role="alert" className="w-full text-sm text-error wrap-anywhere" data-testid="business-read-again-line">
          {line}
        </p>
      )}
    </div>
  );
}

export function BusinessPanel(p: {
  read: NonNullable<BusinessScreen["read"]>;
  profile: BusinessProfile;
  knowledge: KnowledgeBase;
  answers: FounderAnswers;
}): React.JSX.Element {
  const job = p.profile.job?.text ?? "";
  function action(line: Line): React.ReactNode {
    if (!line.change) return null;
    switch (line.id) {
      case "job":
        return (
          <EditDialog
            label={line.label}
            lead={copy("settings.business.lead")}
            testId="business-dialog-job"
            save={async (form) => fromSetting(await rewordBusinessJobAction(form))}
          >
            <TextField name={BUSINESS_JOB_FIELD} label={line.label} value={job} rows={3} />
          </EditDialog>
        );
      case "products":
      case "audienceTerms":
      case "claims":
        return <ListDialog list={line.id} label={line.label} items={p.profile.lists[line.id].map((item) => item.text)} />;
      case "asks":
        return <AsksDialog label={line.label} knowledge={p.knowledge} answers={p.answers} />;
      default:
        return null;
    }
  }

  return (
    <section className={CARD} data-testid="settings-business">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-col">
          <h2 className={CARD_TITLE}>{copy("settings.business.title")}</h2>
          <p className={CARD_LEAD}>{copy("settings.business.lead")}</p>
        </div>
        <div className="flex min-w-0 flex-col">
          {p.read.lines.map((line) => (
            <SettingLine key={line.id} label={line.label} value={line.value} testId={`business-${line.id}`} action={action(line)} />
          ))}
        </div>
        <ReadAgain lastRead={p.read.lastRead} />
      </div>
    </section>
  );
}
