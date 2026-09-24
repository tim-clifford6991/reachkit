// SPEC §5 (2026-09-20, #908) — step two's panel: the business profile
// itself, every item removable and every group with its own Add.
//
// daisyUI classes in the route (`docs/DESIGN.md` rule 1): `card`, `list`,
// `list-row`, `input`, `btn`, `alert`; lucide glyphs at 1.75. No wrapper
// component and no stylesheet: a group is a `<section>` of daisyUI classes,
// repeated over `BUSINESS_GROUPS`, under one more for *What you do* — a
// single sentence, so a text field rather than a list (#1038).
//
// The rules are `_setup/business.ts`'s — what a group holds, how long it may
// grow, what removing and adding do. This file holds the text a founder is
// part-way through typing and which group they are typing it into.
//
// **What it edits is stored** (#970). The groups are five of the six lists
// `site_profile_edits` holds, the items come from the confirmed profile —
// the scan's reading with the customer's own decisions over it — and
// leaving the step records what they took out and what they added, and
// their wording of what the business does. The same lists and the same
// sentence are in Settings › Your business, because they are the same.
"use client";

import type React from "react";
import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  added,
  BUSINESS_GROUPS,
  BUSINESS_MAX,
  isFull,
  removed,
  type BusinessDraft,
  type BusinessGroupId,
} from "./_setup/business";

/** Each group's head, and the quiet note beside it. `products` is the one
 *  group whose note states its bound, because it is the one the founder is
 *  most likely to keep adding to. */
const GROUP_COPY = {
  products: { head: "setup.business.group.products", note: "setup.business.group.products.note" },
  audienceTerms: {
    head: "setup.business.group.audienceTerms",
    note: "setup.business.group.audienceTerms.note",
  },
  claims: { head: "setup.business.group.claims", note: "setup.business.group.claims.note" },
  vocabulary: {
    head: "setup.business.group.vocabulary",
    note: "setup.business.group.vocabulary.note",
  },
  claimsToKeep: { head: "setup.business.group.facts", note: "setup.business.group.facts.note" },
} as const satisfies Record<BusinessGroupId, { head: CopyKey; note: CopyKey }>;

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const QUIET = "text-sm text-base-content/70";
/** A quiet empty (the calm layer, #1059): a flat grey cell and one line —
 *  never a white card or a coloured alert for a thing that is not there. */
const EMPTY = "rounded-box bg-base-200 px-3 py-2 text-sm text-base-content/70";

export function BusinessPanel(p: {
  draft: BusinessDraft;
  onDraft: (next: BusinessDraft) => void;
  job: string;
  onJob: (next: string) => void;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4" data-testid="setup-business">
      <Job job={p.job} onJob={p.onJob} />
      {BUSINESS_GROUPS.map((group) => (
        <Group key={group} group={group} draft={p.draft} onDraft={p.onDraft} />
      ))}
    </div>
  );
}

/** *What you do* — one sentence, opened on the confirmed one and the
 *  founder's to reword in place. Enter must not move them to the next step. */
function Job(p: { job: string; onJob: (next: string) => void }): React.JSX.Element {
  const head = copy("setup.business.group.job");
  return (
    <section className="card bg-base-100 card-border" data-testid="setup-business-job">
      <div className="card-body gap-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 font-medium">{head}</h3>
          <p className={`min-w-0 ${QUIET}`}>{copy("setup.business.group.job.note")}</p>
        </div>
        <input
          type="text"
          className="input min-w-0 w-full"
          aria-label={head}
          value={p.job}
          onChange={(event) => p.onJob(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </div>
    </section>
  );
}

function Group(p: {
  group: BusinessGroupId;
  draft: BusinessDraft;
  onDraft: (next: BusinessDraft) => void;
}): React.JSX.Element {
  const fieldId = useId();
  const [entry, setEntry] = useState("");
  const items = p.draft[p.group];
  const full = isFull(p.draft, p.group);
  const head = copy(GROUP_COPY[p.group].head);

  function add(): void {
    if (entry.trim() === "") return;
    p.onDraft(added(p.draft, p.group, entry));
    setEntry("");
  }

  /** Enter adds the item; it must not move the founder to the next step. */
  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  return (
    <section className="card bg-base-100 card-border" data-testid={`setup-business-${p.group}`}>
      <div className="card-body gap-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 font-medium">{head}</h3>
          <p className={`min-w-0 ${QUIET}`}>
            {copy(GROUP_COPY[p.group].note, { max: String(BUSINESS_MAX[p.group]) })}
          </p>
        </div>

        {items.length === 0 ? (
          <p className={EMPTY} data-testid={`setup-business-${p.group}-empty`}>
            {copy("setup.business.empty")}
          </p>
        ) : (
          <ul className="list" data-testid={`setup-business-${p.group}-items`}>
            {items.map((item) => (
              <li key={item} className="list-row items-center gap-2 px-0">
                <span className="min-w-0 list-col-grow wrap-anywhere">{item}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle shrink-0"
                  aria-label={copy("setup.business.remove", { item })}
                  onClick={() => p.onDraft(removed(p.draft, p.group, item))}
                >
                  <X {...ICON} size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* The field is named by `aria-label` rather than by a visually
            hidden `<label>`: a `sr-only` box is one pixel square with a
            sentence in it, which every containment and clipping check —
            rightly — reads as text escaping its box. */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 gap-2">
            <input
              id={fieldId}
              type="text"
              className="input min-w-0 w-full"
              aria-label={copy("setup.business.add.label", { group: head })}
              value={entry}
              disabled={full}
              onChange={(event) => setEntry(event.target.value)}
              onKeyDown={onKey}
            />
            <button type="button" className="btn btn-soft btn-primary shrink-0" disabled={full} onClick={add}>
              <Plus {...ICON} size={20} />
              {copy("setup.business.add")}
            </button>
          </div>
        </div>

        {full ? (
          <div role="alert" className="alert alert-warning alert-soft text-sm">
            {copy("setup.business.full")}
          </div>
        ) : null}
      </div>
    </section>
  );
}
