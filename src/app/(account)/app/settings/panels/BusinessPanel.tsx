// SPEC §7 (2026-09-20, #908) · issue #926 — what ReachKit knows about the
// business, and the controls that correct it.
//
// "**What a page is written from.** The confirmed business profile — what the
// business does, sells and promises, who it serves, its vocabulary — joins
// the writer's inputs."
//
// daisyUI classes in the route; each field is a `SettingRow`, the row every Settings board draws (canvas v36).
// Only groups that have something in them are drawn (#926), and a group that is drawn keeps its Add, because
// the customer adds or takes out a buyer term or word (SPEC §4, 2026-10-15, issue 1454). Tone and how the
// business refers to itself are not drawn here, nor the voice summary's two claim lists: Your voice owns them.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Pencil, Plus, RefreshCw, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { say } from "@/app/_toast/say";
import {
  type BusinessItem,
  type BusinessList,
  type BusinessProfile,
} from "@/lib/site-profile/business/types";
import {
  addBusinessItemAction,
  removeBusinessItemAction,
  rewordBusinessJobAction,
} from "../business-actions";
import { remeasureNowAction } from "../change-actions";
import { MARKET_REMEASURE_INITIAL, type MarketRemeasureState } from "../market-state";
import { formatDate } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import {
  BUSINESS_ITEM_FIELD,
  BUSINESS_JOB_FIELD,
  BUSINESS_LIST_FIELD,
} from "../panel-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import { SettingRow } from "./SettingRow";

/** The four lists the board draws, in its order. The voice summary's claim lists are Your voice's to state. */
const GROUP_COPY: Readonly<Partial<Record<BusinessList, CopyKey>>> = {
  products: "settings.business.products",
  audienceTerms: "settings.business.audienceTerms",
  claims: "settings.business.claims",
  vocabulary: "settings.business.vocabulary",
};
const LIST_ORDER = Object.keys(GROUP_COPY) as BusinessList[];

/** An item's remove control, named for the item it removes. */
function RemoveButton(p: {
  list: BusinessList;
  item: BusinessItem;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  return (
    // A flex box, never `display: contents`: a form with no box of its own
    // puts its button outside a parent every containment check reads.
    <form
      action={(form) => p.writer.press(removeBusinessItemAction, form)}
      className="flex shrink-0 items-center"
    >
      <input type="hidden" name={BUSINESS_LIST_FIELD} value={p.list} />
      <input type="hidden" name={BUSINESS_ITEM_FIELD} value={p.item.text} />
      <button
        type="submit"
        // The board's 44px target at the chip's end.
        className="btn btn-ghost btn-circle size-11 shrink-0"
        disabled={p.writer.busy}
        aria-label={copy("settings.business.remove", { item: p.item.text })}
      >
        <X size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </form>
  );
}

/** *new* for a found item the customer has not seen, *yours* for one they typed. */
function Mark(p: { item: BusinessItem }): React.JSX.Element | null {
  const key = p.item.isNew
    ? ("settings.business.mark.new" as const)
    : p.item.source === "yours"
      ? ("settings.business.mark.yours" as const)
      : null;
  if (key === null) return null;
  return (
    <span className={`text-xs font-semibold uppercase ${p.item.isNew ? "text-primary" : "text-base-content/70"}`}>
      {copy(key)}
    </span>
  );
}

/** One item, as the board's 44px chip whose text folds inside it rather than overflow or clamp. */
function Chip(p: {
  list: BusinessList;
  item: BusinessItem;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  return (
    <span
      className={`badge h-auto min-h-11 max-w-full min-w-0 items-center gap-1.5 py-0 pr-0 pl-3.5 text-sm whitespace-normal wrap-anywhere ${
        p.item.source === "yours" ? "badge-outline" : "badge-ghost"
      }`}
      data-testid="business-item"
    >
      <span className="min-w-0">{p.item.text}</span>
      <Mark item={p.item} />
      <RemoveButton list={p.list} item={p.item} writer={p.writer} />
    </span>
  );
}

/** One group: its head, its chips, and an Add at the end of them that opens its field. */
function Group(p: {
  list: BusinessList;
  items: readonly BusinessItem[];
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState("");
  const head = copy(GROUP_COPY[p.list]!);
  const label = copy("settings.business.add.label", { group: head });

  return (
    <SettingRow name={head} testId={`business-group-${p.list}`} below={
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {p.items.map((item) => (
          <Chip key={`${item.source}:${item.text}`} list={p.list} item={item} writer={p.writer} />
        ))}
        {adding ? (
          <form
            action={(form) => {
              p.writer.press(addBusinessItemAction, form);
              setEntry("");
              setAdding(false);
            }}
            className="flex w-full min-w-0 items-center gap-2 sm:w-auto"
            data-testid={`business-add-${p.list}`}
          >
            <input type="hidden" name={BUSINESS_LIST_FIELD} value={p.list} />
            {/* `aria-label`, not an `sr-only` label: a one-pixel box of text reads as overflow. */}
            <input name={BUSINESS_ITEM_FIELD} className="input min-w-0 grow" aria-label={label} value={entry} onChange={(e) => setEntry(e.target.value)} autoFocus />
            <button type="submit" className={OUTLINE} aria-label={label} disabled={p.writer.busy || entry.trim() === ""}>
              {p.writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
              {copy("settings.business.add")}
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost min-h-11 px-3 text-primary" aria-label={label} onClick={() => setAdding(true)} data-testid={`business-open-add-${p.list}`}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {copy("settings.business.add")}
          </button>
        )}
      </div>
    } />
  );
}

/** The board's bordered secondary button, at the 44px target. */
const OUTLINE = "btn btn-outline border-base-300 bg-base-100 text-primary min-h-11 shrink-0";

/** *What you do*, the one rewordable field, and *Kind of business* under it as a read. */
function Job(p: {
  profile: BusinessProfile;
  kind: string | null;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const { job } = p.profile;
  const kind = p.kind ?? p.profile.offeringType;

  return (
    <>
      <SettingRow name={copy("settings.business.job")} testId="business-job" below={
        editing ? (
          <form
            action={(form) => {
              p.writer.press(rewordBusinessJobAction, form);
              setEditing(false);
            }}
            className="flex min-w-0 flex-col gap-2"
            data-testid="business-job-edit"
          >
            <textarea
              name={BUSINESS_JOB_FIELD}
              className="textarea min-w-0 w-full"
              rows={2}
              aria-label={copy("settings.business.job")}
              defaultValue={job?.text ?? ""}
            />
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="submit" className="btn btn-primary min-h-11" disabled={p.writer.busy}>
                {p.writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy("settings.save")}
              </button>
              <button type="button" className="btn btn-ghost min-h-11" onClick={() => setEditing(false)}>
                {copy("settings.cancel-edit")}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="min-w-0 wrap-anywhere">
              {job === null ? copy("settings.business.unread") : job.text}
              {job?.source === "yours" ? (
                <> <span className="badge badge-ghost badge-sm">{copy("settings.business.mark.yours")}</span></>
              ) : null}
            </p>
            <button type="button" className={OUTLINE} onClick={() => setEditing(true)}>
              <Pencil size={16} strokeWidth={1.75} aria-hidden />
              {copy("settings.business.reword")}
            </button>
          </div>
        )
      } />
      {kind === null ? null : (
        <SettingRow name={copy("settings.business.offering")} testId="business-offering" below={
          <p className="min-w-0 wrap-anywhere">{kind}</p>
        } />
      )}
    </>
  );
}

/** The last read, and the bounded re-read `remeasureNowAction` already owns. */
function ReadAgain(p: { profile: BusinessProfile; timeZone: string }): React.JSX.Element {
  const [remeasure, setRemeasure] = useState<MarketRemeasureState>(MARKET_REMEASURE_INITIAL);
  const [busy, startReading] = useTransition();
  const [failed, setFailed] = useState(false);

  function readAgain(): void {
    startReading(async () => {
      setFailed(false);
      try {
        const next = await remeasureNowAction();
        // A started pass answers once; the side panel then carries it.
        if (next.answer === "started") {
          const started = writtenLine("settings.market.remeasuring");
          if (started !== null) say(started, "ok");
          setRemeasure(MARKET_REMEASURE_INITIAL);
        } else setRemeasure(next);
      } catch {
        setFailed(true);
      }
    });
  }

  const line = failed ? copy("settings.answer.could-not-ask") : remeasure.answer === "refused" ? remeasure.line : null;
  const { readAt, pagesRead } = p.profile;
  const on = readAt === null ? null : formatDate(readAt, p.timeZone);

  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-sm text-base-content/70 wrap-anywhere" data-testid="business-read-line">
          {on === null
            ? copy("settings.business.read-never")
            : pagesRead === null
              ? copy("settings.business.read-at", { on })
              : copy("settings.business.read-line", { on, count: String(pagesRead) })}
        </p>
        <button
          type="button"
          className="btn btn-soft btn-primary min-h-11"
          disabled={busy}
          onClick={readAgain}
          data-testid="business-read-again"
        >
          {busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <RefreshCw size={16} strokeWidth={1.75} aria-hidden />}
          {copy("settings.business.read-again")}
        </button>
      </div>
      {line === null ? null : (
        <p role="alert" className="text-xs text-error wrap-anywhere" data-testid="business-read-again-line">
          {line}
        </p>
      )}
    </div>
  );
}

export function BusinessPanel(p: {
  profile: BusinessProfile;
  /** The kind of business in the report's word; `null` draws the read's own text where it has one. */
  kind?: string | null;
  /** Whether anything at all has been read, decided by the caller from `profileIsEmpty`. */
  empty: boolean;
  timeZone: string;
}): React.JSX.Element {
  // The one writer every control on this card presses through, and its one Saved badge.
  const writer = useSetting();

  const lists = LIST_ORDER.filter((list) => p.profile.lists[list].length > 0);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-business">
      <div className="card-body gap-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="card-title min-w-0 flex-wrap text-(length:--h3)">{copy("settings.business.title")}</h2>
            <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.business.lead")}</p>
          </div>
          {writer.saved ? <span className={SAVED_BADGE_CLASS}>{copy("settings.answer.saved-badge")}</span> : null}
        </div>

        {p.empty ? (
          <p className="text-sm wrap-anywhere" data-testid="business-unread">
            {copy("settings.business.unread")}
          </p>
        ) : (
          <div className="flex min-w-0 flex-col">
            <Job profile={p.profile} kind={p.kind ?? null} writer={writer} />
            {lists.map((list) => (
              <Group key={list} list={list} items={p.profile.lists[list]} writer={writer} />
            ))}
          </div>
        )}

        <ReadAgain profile={p.profile} timeZone={p.timeZone} />
      </div>
    </section>
  );
}
