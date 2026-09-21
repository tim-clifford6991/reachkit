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
// have the site read — which is what the side card's *Read my site again
// now* is for. That is the honest arrangement: this screen corrects a
// reading, and there is nothing yet to correct.
//
// **Nothing here scrolls sideways.** The items are `list-row`s that wrap,
// and a long claim folds inside its row; at 390 the row's controls sit under
// its text rather than beside it. `docs/DESIGN.md`'s no-overflow rule, and
// the reason this file has no `overflow-x-auto` anywhere: a sentence read
// off a customer's own site is prose, and prose wraps.
"use client";

import type React from "react";
import { useState } from "react";
import { Briefcase, Plus, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  BUSINESS_LISTS,
  type BusinessItem,
  type BusinessList,
  type BusinessProfile,
} from "@/lib/site-profile/business/types";
import {
  addBusinessItemAction,
  BUSINESS_ITEM_FIELD,
  BUSINESS_JOB_FIELD,
  BUSINESS_LIST_FIELD,
  removeBusinessItemAction,
  rewordBusinessJobAction,
} from "../business-actions";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";

/** Each group's head, and the quiet note beside it where #926 gives one.
 *  Keyed by the tuple, so a seventh field is a compile error here. */
const GROUP_COPY: Readonly<Record<BusinessList, { head: CopyKey; note?: CopyKey }>> = {
  products: { head: "settings.business.products" },
  claims: { head: "settings.business.claims", note: "settings.business.claims.hint" },
  audienceTerms: { head: "settings.business.audienceTerms" },
  vocabulary: { head: "settings.business.vocabulary", note: "settings.business.vocabulary.hint" },
  claimsToKeep: { head: "settings.business.claimsToKeep" },
  claimsToAvoid: { head: "settings.business.claimsToAvoid" },
};

/** One item, with its mark and its remove control.
 *
 *  The mark is the whole of #926's suggestion rule made visible: an item the
 *  last pass found that the customer has not seen says *new*, one they typed
 *  says *yours*, and one the site has always said needs no mark at all. */
function Item(p: {
  list: BusinessList;
  item: BusinessItem;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  return (
    <li className="list-row min-w-0 flex-wrap items-start gap-2">
      <span className="min-w-0 grow wrap-anywhere">{p.item.text}</span>
      {p.item.isNew ? (
        <span className="badge badge-primary badge-soft badge-sm shrink-0">
          {copy("settings.business.mark.new")}
        </span>
      ) : p.item.source === "yours" ? (
        <span className="badge badge-ghost badge-sm shrink-0">
          {copy("settings.business.mark.yours")}
        </span>
      ) : null}
      <form
        action={(form) => p.writer.press(removeBusinessItemAction, form)}
        className="shrink-0"
      >
        <input type="hidden" name={BUSINESS_LIST_FIELD} value={p.list} />
        <input type="hidden" name={BUSINESS_ITEM_FIELD} value={p.item.text} />
        <button
          type="submit"
          className="btn btn-ghost btn-xs btn-square"
          disabled={p.writer.busy}
          aria-label={copy("settings.business.remove", { item: p.item.text })}
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </form>
    </li>
  );
}

/** One group: its head, its items, and its own Add. */
function Group(p: {
  list: BusinessList;
  items: readonly BusinessItem[];
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [entry, setEntry] = useState("");
  const head = copy(GROUP_COPY[p.list].head);
  const note = GROUP_COPY[p.list].note;

  return (
    <section className="flex min-w-0 flex-col gap-2" data-testid={`business-group-${p.list}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <h3 className="eyebrow">{head}</h3>
        {note === undefined ? null : (
          <span className="text-xs text-base-content/60">{copy(note)}</span>
        )}
      </div>

      <ul className="list bg-base-100 min-w-0 rounded-box">
        {p.items.map((item) => (
          <Item
            key={`${item.source}:${item.text}`}
            list={p.list}
            item={item}
            writer={p.writer}
          />
        ))}
      </ul>

      <form
        action={(form) => {
          p.writer.press(addBusinessItemAction, form);
          setEntry("");
        }}
        className="flex min-w-0 flex-wrap items-end gap-2"
        data-testid={`business-add-${p.list}`}
      >
        <input type="hidden" name={BUSINESS_LIST_FIELD} value={p.list} />
        {/* Named by `aria-label` and not by a visually hidden `<label>`:
            a `sr-only` box is one pixel square with a sentence in it, which
            every containment and clipping check — rightly — reads as text
            escaping its box. `setup/BusinessPanel.tsx` records the same
            finding for the same control, and this screen's own 390 sweep
            reported six of them before this line. */}
        <input
          name={BUSINESS_ITEM_FIELD}
          className="input input-sm min-w-0 grow"
          aria-label={copy("settings.business.add.label", { group: head })}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-outline btn-sm"
          disabled={p.writer.busy || entry.trim() === ""}
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          {copy("settings.business.add")}
        </button>
      </form>
    </section>
  );
}

/** *What you do* — the one field #926 names as rewordable, so the one that
 *  is a field rather than a list. `offeringType` stands beside it as a read:
 *  #926 names it to surface and not to correct. */
function Job(p: {
  profile: BusinessProfile;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const { job, offeringType } = p.profile;

  return (
    <section className="flex min-w-0 flex-col gap-2" data-testid="business-job">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <h3 className="eyebrow">{copy("settings.business.job")}</h3>
        <span className="text-xs text-base-content/60">{copy("settings.business.job.hint")}</span>
      </div>

      {editing ? (
        <form
          action={(form) => {
            p.writer.press(rewordBusinessJobAction, form);
            setEditing(false);
          }}
          className="flex min-w-0 flex-col gap-2"
          data-testid="business-job-edit"
        >
          {/* `aria-label`, for the reason the Add field above states. */}
          <textarea
            name={BUSINESS_JOB_FIELD}
            className="textarea min-w-0 w-full"
            rows={2}
            aria-label={copy("settings.business.job")}
            defaultValue={job?.text ?? ""}
          />
          <div className="flex min-w-0 flex-wrap gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={p.writer.busy}>
              {copy("settings.save")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              {copy("settings.cancel-edit")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <p className="min-w-0 grow wrap-anywhere">
            {job === null ? copy("settings.business.unread") : job.text}
          </p>
          {job?.source === "yours" ? (
            <span className="badge badge-ghost badge-sm shrink-0">
              {copy("settings.business.mark.yours")}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-outline btn-sm shrink-0"
            onClick={() => setEditing(true)}
          >
            {copy("settings.business.reword")}
          </button>
        </div>
      )}

      {offeringType === null ? null : (
        <p className="text-xs text-base-content/60 wrap-anywhere">
          <span className="font-semibold">{copy("settings.business.offering")} </span>
          {offeringType}
        </p>
      )}
    </section>
  );
}

export function BusinessPanel(p: {
  profile: BusinessProfile;
  siteName: string | null;
  /** Whether anything at all has been read. Decided by the caller, from
   *  `profileIsEmpty` — the panel does not re-derive it. */
  empty: boolean;
}): React.JSX.Element {
  // The one writer every control on this card presses through, and the one
  // place the answer comes from: `useSetting` says in words what came back
  // (SPEC §4, 2026-09-20: "Every action answers") and holds the card's own
  // *Saved* badge. Nothing on this card keeps an answer of its own.
  const writer = useSetting();

  const lists = BUSINESS_LISTS.filter((list) => p.profile.lists[list].length > 0);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-business">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="card-title min-w-0 flex-wrap text-base">
            <Briefcase size={20} strokeWidth={1.75} aria-hidden />
            {p.siteName === null
              ? copy("settings.business.title.no-name")
              : copy("settings.business.title", { business: p.siteName })}
          </h2>
          {writer.saved ? (
            <span className={SAVED_BADGE_CLASS}>{copy("settings.answer.saved-badge")}</span>
          ) : null}
        </div>
        <p className="text-sm text-base-content/70 wrap-anywhere">
          {copy("settings.business.lead")}
        </p>

        {p.empty ? (
          <p className="text-sm wrap-anywhere" data-testid="business-unread">
            {copy("settings.business.unread")}
          </p>
        ) : (
          <>
            <Job profile={p.profile} writer={writer} />
            {lists.map((list) => (
              <Group
                key={list}
                list={list}
                items={p.profile.lists[list]}
                writer={writer}
              />
            ))}
            {p.profile.tone === null && p.profile.person === null ? null : (
              <dl className="border-base-300 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t pt-4 text-sm">
                {p.profile.tone === null ? null : (
                  <>
                    <dt className="text-base-content/70">{copy("settings.business.tone")}</dt>
                    <dd className="wrap-anywhere" data-testid="business-tone">
                      {p.profile.tone}
                    </dd>
                  </>
                )}
                {p.profile.person === null ? null : (
                  <>
                    <dt className="text-base-content/70">{copy("settings.business.person")}</dt>
                    <dd className="wrap-anywhere" data-testid="business-person">
                      {p.profile.person}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </>
        )}


      </div>
    </section>
  );
}
