// SPEC §7 (2026-09-20, #908) · issue #926 — what ReachKit knows about the
// business, and the controls that correct it.
//
// "**What a page is written from.** The confirmed business profile — what the
// business does, sells and promises, who it serves, its vocabulary — joins
// the writer's inputs."
//
// daisyUI classes in the route (`docs/DESIGN.md` rule 1): `card`,
// `card-body`, `card-title`, `list`, `list-row`, `badge`, `input`, `btn`,
// `textarea`, `divider`. lucide glyphs at 1.75. No wrapper component, no
// stylesheet, and no library added — the shape is `setup/BusinessPanel.tsx`'s,
// which draws the same profile at step two.
//
// **It draws only groups that have something in them.** #926: show only
// fields the crawl already stores, never a placeholder for one it does not.
// A group the site was not read for is absent, not empty — and a profile
// with nothing in any group is one written line (`settings.business.unread`)
// rather than nine empty groups with Add buttons on them. The exception is
// deliberate: a group that has items *and* an Add control keeps the Add,
// because a customer may want to add to a list the crawl only half read.
//
// **Every list still takes an addition.** A group with no derived items is
// not drawn, so the way to put the first item into an unread group is to
// have the site read — which is what this card's *Read my site again now*
// is for. That is the honest arrangement: this screen corrects a
// reading, and there is nothing yet to correct.
//
// **Nothing here scrolls sideways.** Every item is a chip that wraps, and a
// long claim folds inside its chip. `docs/DESIGN.md`'s no-overflow rule, and
// the reason this file has no `overflow-x-auto` anywhere: a sentence read
// off a customer's own site is prose, and prose wraps.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
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
import type { OnAPage } from "../on-a-page";
import { formatDate } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import {
  BUSINESS_ITEM_FIELD,
  BUSINESS_JOB_FIELD,
  BUSINESS_LIST_FIELD,
} from "../panel-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import { SettingRow } from "./SettingRow";

/** Each group's head and the quiet hint beside it, in the board's order. */
const GROUP_COPY: Readonly<Record<BusinessList, { head: CopyKey; note?: CopyKey }>> = {
  products: { head: "settings.business.products" },
  audienceTerms: { head: "settings.business.audienceTerms" },
  claims: { head: "settings.business.claims", note: "settings.business.claims.hint" },
  vocabulary: { head: "settings.business.vocabulary", note: "settings.business.vocabulary.hint" },
  claimsToKeep: { head: "settings.business.claimsToKeep" },
  claimsToAvoid: { head: "settings.business.claimsToAvoid" },
};
const LIST_ORDER = Object.keys(GROUP_COPY) as BusinessList[];
const JOB = { head: "settings.business.job", note: "settings.business.job.hint" } as const;

/** A field's label with its hint inside it, so the two read as one line. */
function Label(p: { head: string; note?: CopyKey }): React.JSX.Element {
  return (
    <h3 className="eyebrow">
      {p.head}
      {p.note === undefined ? null : <> <span className="font-normal normal-case text-base-content/70">{copy(p.note)}</span></>}
    </h3>
  );
}

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
        // 24px inside a 32px chip: the whole chip is the touch area, this the part that removes.
        className="btn btn-ghost btn-circle btn-xs size-6 min-h-6 shrink-0"
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
    <span className={`text-[10px] font-semibold uppercase ${p.item.isNew ? "text-primary" : "text-base-content/70"}`}>
      {copy(key)}
    </span>
  );
}

/** One item, as a chip whose text folds inside it rather than overflow or clamp. */
function Chip(p: {
  list: BusinessList;
  item: BusinessItem;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  return (
    <span
      className={`badge badge-lg h-auto max-w-full min-w-0 items-center gap-1.5 py-1 whitespace-normal wrap-anywhere ${
        p.item.source === "yours" ? "badge-outline" : ""
      }`}
      data-testid="business-item"
    >
      <span className="min-w-0">{p.item.text}</span>
      <Mark item={p.item} />
      <RemoveButton list={p.list} item={p.item} writer={p.writer} />
    </span>
  );
}

/** One group: its head, its chips, and its own Add at the end of them. */
function Group(p: {
  list: BusinessList;
  items: readonly BusinessItem[];
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [entry, setEntry] = useState("");
  const head = copy(GROUP_COPY[p.list].head);

  return (
    <section className="flex min-w-0 flex-col gap-2" data-testid={`business-group-${p.list}`}>
      <Label head={head} note={GROUP_COPY[p.list].note} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {p.items.map((item) => (
          <Chip key={`${item.source}:${item.text}`} list={p.list} item={item} writer={p.writer} />
        ))}
        <form
          action={(form) => {
            p.writer.press(addBusinessItemAction, form);
            setEntry("");
          }}
          className="flex w-full min-w-0 items-center gap-2 sm:w-auto"
          data-testid={`business-add-${p.list}`}
        >
          <input type="hidden" name={BUSINESS_LIST_FIELD} value={p.list} />
          {/* `aria-label`, not an `sr-only` label: a one-pixel box of text reads as overflow. */}
          <input
            name={BUSINESS_ITEM_FIELD}
            className="input input-sm min-w-0 grow"
            aria-label={copy("settings.business.add.label", { group: head })}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-soft btn-primary btn-sm shrink-0"
            aria-label={copy("settings.business.add.label", { group: head })}
            disabled={p.writer.busy || entry.trim() === ""}
          >
            {p.writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <Plus size={16} strokeWidth={1.75} aria-hidden />}
            {copy("settings.business.add")}
          </button>
        </form>
      </div>
    </section>
  );
}

/** *What you do*, the one rewordable field, and *Kind of business* beside it as a read. */
function Job(p: {
  profile: BusinessProfile;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const { job, offeringType } = p.profile;

  return (
    <>
      <section className="flex min-w-0 flex-col gap-2" data-testid="business-job">
        <Label head={copy(JOB.head)} note={JOB.note} />
        {editing ? (
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
              <button type="submit" className="btn btn-primary btn-sm" disabled={p.writer.busy}>
                {p.writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy("settings.save")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                {copy("settings.cancel-edit")}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <p className="min-w-0 grow wrap-anywhere">{job === null ? copy("settings.business.unread") : job.text}</p>
            {job?.source === "yours" ? (
              <span className="badge badge-ghost badge-sm shrink-0">{copy("settings.business.mark.yours")}</span>
            ) : null}
            <button type="button" className="btn btn-soft btn-primary btn-sm shrink-0" onClick={() => setEditing(true)}>
              {copy("settings.business.reword")}
            </button>
          </div>
        )}
      </section>
      {offeringType === null ? null : (
        <section className="flex min-w-0 flex-col gap-2" data-testid="business-offering">
          <Label head={copy("settings.business.offering")} />
          <p className="min-w-0 wrap-anywhere">{offeringType}</p>
        </section>
      )}
    </>
  );
}

const FROM_COPY = {
  claims: "settings.business.example.from.claims",
  vocabulary: "settings.business.example.from.vocabulary",
  both: "settings.business.example.from.both",
} as const satisfies Record<OnAPage["from"], CopyKey>;

/** One live sentence that uses what this card holds, word for word, its matches marked. */
function Example(p: { example: OnAPage; timeZone: string }): React.JSX.Element {
  const { example } = p;
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-box bg-base-200 p-4" data-testid="business-example">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{copy("settings.business.example.head")}</p>
        <span className="badge badge-ghost badge-sm">{formatDate(example.publishedAt, p.timeZone)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1" lang={example.lang}>
        <a className="link link-hover min-w-0 font-semibold wrap-anywhere" href={example.url} target="_blank" rel="noreferrer">
          {example.title === "" ? example.url : example.title}
        </a>
        <p className="min-w-0 wrap-anywhere" data-testid="business-example-quote">
          {example.parts.map((part, at) => (part.mark ? <mark key={at}>{part.text}</mark> : part.text))}
        </p>
      </div>
      <figcaption className="flex min-w-0 flex-wrap justify-between gap-2 text-xs text-base-content/70">
        <span>{copy(FROM_COPY[example.from])}</span> <span>{copy("settings.business.example.note")}</span>
      </figcaption>
    </figure>
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
    <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-4">
      <p className="text-sm text-base-content/70 wrap-anywhere" data-testid="business-read-line">
        {on === null
          ? copy("settings.business.read-never")
          : pagesRead === null
            ? copy("settings.business.read-at", { on })
            : copy("settings.business.read-line", { on, count: String(pagesRead) })}
      </p>
      <button
        type="button"
        className="btn btn-soft btn-primary btn-sm self-start"
        disabled={busy}
        onClick={readAgain}
        data-testid="business-read-again"
      >
        {busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <RefreshCw size={16} strokeWidth={1.75} aria-hidden />}
        {copy("settings.business.read-again")}
      </button>
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
  siteName: string | null;
  /** Whether anything at all has been read, decided by the caller from `profileIsEmpty`. */
  empty: boolean;
  /** "How it shows on a page"; `null` draws no block. */
  example: OnAPage | null;
  timeZone: string;
}): React.JSX.Element {
  // The one writer every control on this card presses through, and its one Saved badge.
  const writer = useSetting();

  const lists = LIST_ORDER.filter((list) => p.profile.lists[list].length > 0);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-business">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="card-title min-w-0 flex-wrap text-base">
            {p.siteName === null
              ? copy("settings.business.title.no-name")
              : copy("settings.business.title", { business: p.siteName })}
          </h2>
          {writer.saved ? <span className={SAVED_BADGE_CLASS}>{copy("settings.answer.saved-badge")}</span> : null}
        </div>
        <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.business.lead")}</p>

        {p.empty ? (
          <p className="text-sm wrap-anywhere" data-testid="business-unread">
            {copy("settings.business.unread")}
          </p>
        ) : (
          <>
            <Job profile={p.profile} writer={writer} />
            {lists.map((list) => (
              <Group key={list} list={list} items={p.profile.lists[list]} writer={writer} />
            ))}
            {p.profile.tone === null && p.profile.person === null ? null : (
              // The settable-row shape every Settings tab draws (#1089).
              <div className="border-base-300 flex min-w-0 flex-col border-t pt-4">
                {p.profile.tone === null ? null : (
                  <SettingRow name={copy("settings.business.tone")} testId="business-row-tone">
                    <span className="min-w-0 wrap-anywhere" data-testid="business-tone">
                      {p.profile.tone}
                    </span>
                  </SettingRow>
                )}
                {p.profile.person === null ? null : (
                  <SettingRow name={copy("settings.business.person")} testId="business-row-person">
                    <span className="min-w-0 wrap-anywhere" data-testid="business-person">
                      {p.profile.person}
                    </span>
                  </SettingRow>
                )}
              </div>
            )}
            {p.example === null ? null : <Example example={p.example} timeZone={p.timeZone} />}
          </>
        )}

        <ReadAgain profile={p.profile} timeZone={p.timeZone} />
      </div>
    </section>
  );
}
