// BUILD §4.7 — "**Your market** (chip + Edit + 'changing this rebuilds the
// search set and the 12 questions next Monday')".
//
// Two of the fourteen settable keys live here: `category`, which §4.7 draws as
// a chip with an Edit beside it, and `domain` — "the domain the site is
// measured and published under" (REQ-070 c1), which belongs with the market
// because changing either one has the same consequence and the same clock.
//
// That consequence is the card's one written line, and it is stated once for
// the card rather than twice for the two controls: REQ-071 puts the domain,
// the category and the competitor set all at the next weekly re-measurement
// and never on save, so a second copy of the line beside the second control
// would be the same sentence pretending to be two facts.
//
// **Edit opens a field, and the field is the write path** (issue #231).
// Until now it was a control with no handler. It is wired to
// `../change-actions.ts` and therefore to `saveDomain` / `saveCategory`,
// which are the only ways this product changes a declared answer; there is
// no second one on this screen.
//
// **This card decides nothing about a change.** Whether a domain can be
// reached, what a save writes and when it takes effect are
// `@/lib/market/changes`'s, and which line the card states is `../model`'s
// `marketChange` — the same chooser the server called, asked again with the
// field the customer has open. The panel renders what it is handed and
// states nothing of its own.
//
// **One field at a time.** Opening the second closes the first, because the
// card states one dated line and two open fields would be two answers being
// typed against one sentence. Leaving a field open is undoable: a customer
// who pressed Edit to see what was there has changed nothing, and closing
// costs them nothing.
"use client";

import type React from "react";
import { useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { Input } from "@/ui/components/Input";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { saveCategoryAction, saveDomainAction } from "../change-actions";
import {
  MARKET_CATEGORY_FIELD,
  MARKET_CHANGE_INITIAL,
  MARKET_DOMAIN_FIELD,
  refusalKeyOf,
  savedInstantOf,
  type MarketChangeState,
} from "../market-state";
import { marketChange, type SettingsModel } from "../model";

/** The two answers this card changes. `../model`'s own union — the same
 *  one `marketChange` and `CHANGE_COPY_KEY` are keyed by — so a third
 *  declared answer cannot appear here without appearing in both. */
type Answer = "domain" | "category";

/** Which action, which wire name and which label each answer's field
 *  carries. One record rather than two branches: the two fields differ in
 *  nothing but these, and a record makes that structural. */
const FIELD: Record<
  Answer,
  { action: (form: FormData) => Promise<MarketChangeState>; name: string; labelKey: "settings.market.domain" | "settings.market.category" }
> = {
  domain: { action: saveDomainAction, name: MARKET_DOMAIN_FIELD, labelKey: "settings.market.domain" },
  category: { action: saveCategoryAction, name: MARKET_CATEGORY_FIELD, labelKey: "settings.market.category" },
};

/** The card's own slice of the model, and no more. A client panel takes
 *  what it renders (`AccountPanel`'s shape, since #134): the whole model
 *  would cross the server boundary into the browser bundle, destinations,
 *  billing and all, for a card that states three values. */
export function MarketPanel(p: {
  market: SettingsModel["market"];
  domain: string;
  /** REQ-073 c1's stated zone — the one this card writes a date in when a
   *  save answers before the re-read comes back. */
  timeZone: string;
}): React.JSX.Element {
  /** Which answer has a field open, and what is in it. `null` is the
   *  ordinary state of this card: nothing is being changed. */
  const [editing, setEditing] = useState<Answer | null>(null);
  // The typed value, kept across a refusal — `Input`'s contract ("the
  // invalid value stays intact"). An uncontrolled field would be cleared
  // by React's own post-action form reset, which is the opposite of what a
  // customer told "we cannot reach that domain" needs.
  const [value, setValue] = useState("");
  /** What the last press answered. Held here rather than in
   *  `useActionState` so that pressing Edit again asks a fresh question
   *  instead of reopening a field still showing the previous answer. */
  const [answer, setAnswer] = useState<MarketChangeState>(MARKET_CHANGE_INITIAL);

  const stated = (answer_: Answer): string =>
    answer_ === "domain" ? p.domain : p.market.category;

  function open(next: Answer): void {
    setEditing(next);
    setValue(stated(next));
    setAnswer(MARKET_CHANGE_INITIAL);
  }

  async function submit(form: FormData): Promise<void> {
    if (editing === null) return;
    const next = await FIELD[editing].action(form);
    setAnswer(next);
    // A save closes the field: what was being typed is now what the site
    // is measured as, and the card states when that takes effect. A
    // refusal keeps it open, with the value intact and the reason on it.
    if (next.answer === "saved") setEditing(null);
    if (next.answer === "refused") setValue(next.value);
  }

  // REQ-071 c1 and c6 (issue #204, #231). One written line either way: a
  // dated one while a change stands or is being typed, the card's standing
  // one otherwise. The model chose which and wrote the date; this panel
  // renders it — `{change}` is the owner's word for the answer, read from
  // its own key, never the engine's `domain` / `category`.
  //
  // A save that has just answered outranks both: its date is the one this
  // press earned, written here through the same formatter the model uses,
  // because the revalidated read has not come back yet.
  //
  // `data-testid` is `market-change-line` and not `setting-market-change`:
  // the `setting-*` namespace is REQ-070 c1's closed offer of exactly the
  // fourteen controls, and this is a written line rather than a control
  // (`screen.test.tsx` reads that namespace off the document).
  const change = marketChange(p.market, editing);
  const justSaved = savedInstantOf(answer);
  const effectiveLine = (date: string): string | null =>
    writtenLine("settings.market.effectiveOn", { date });
  const dated =
    justSaved !== null
      ? effectiveLine(formatDate(new Date(justSaved), p.timeZone))
      : change === null
        ? null
        : change.saved
          ? effectiveLine(change.on)
          : writtenLine("settings.market.pending", {
              date: change.on,
              change: copy(change.changeKey),
            });
  const warned = justSaved === null && change?.saved === false;
  const effect = change === null && justSaved === null ? writtenLine("settings.market.effect") : null;

  const refusal = refusalKeyOf(answer);
  const refusalLine = refusal === null ? null : writtenLine(refusal);

  // A function that returns elements, deliberately **not** a component
  // declared here: a nested component is a new type on every render, so
  // React would unmount and remount the field on each keystroke and the
  // customer would lose the caret after every character.
  function editingField(answer_: Answer): React.JSX.Element {
    const field = FIELD[answer_];
    return (
      <form action={submit} className="flex min-w-0 flex-col gap-1" data-testid={`edit-${answer_}`}>
        {/* Two calls, not one with a spread: `InputProps` is a union in
            which `invalid: true` and `invalidMessage` arrive together, and
            spreading a maybe-object would defeat exactly the guarantee
            that union exists for. */}
        {refusalLine === null ? (
          <Input
            name={field.name}
            label={copy(field.labelKey)}
            placeholder={copy(field.labelKey)}
            value={value}
            onChange={setValue}
          />
        ) : (
          <Input
            name={field.name}
            label={copy(field.labelKey)}
            placeholder={copy(field.labelKey)}
            value={value}
            onChange={setValue}
            invalid
            invalidMessage={refusalLine}
          />
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Btn label={copy("settings.save")} size="sm" type="submit" />
          <Btn
            label={copy("settings.cancel-edit")}
            size="sm"
            variant="ghost"
            onClick={() => setEditing(null)}
          />
        </div>
      </form>
    );
  }

  return (
    <Card state="default" title={<CardHead eyebrow={copy("settings.market.title")} />}>
      <div className="flex min-w-0 flex-col gap-3">
        {/* S18's order: the SITE first and the market second — the card is
            "Your site & market", and the domain is the thing the market is
            derived for. A row is its name at the near edge with the stored
            value and its control at the far one, hairline between; the
            editing arm keeps its own column, because a field and its
            refusal line do not fit on one line at 320. */}
        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-domain">
          <span className="eyebrow opacity-60">{copy("settings.market.domain")}</span>
          {editing === "domain" ? (
            editingField("domain")
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="num min-w-0 wrap-anywhere">{p.domain}</span>
              <Btn label={copy("settings.edit")} size="sm" variant="tertiary" onClick={() => open("domain")} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-category">
          <span className="eyebrow opacity-60">{copy("settings.market.category")}</span>
          {editing === "category" ? (
            editingField("category")
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* §2.3: a search query and the buyer vocabulary it is written in
                  are code-like strings, so the chip is mono. */}
              <span className="num inline-flex min-w-0 items-center gap-2 wrap-anywhere">{p.market.category}</span>
              <Btn label={copy("settings.edit")} size="sm" variant="tertiary" onClick={() => open("category")} />
            </div>
          )}
        </div>
      </div>

      {effect === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{effect}</p>}
      {dated === null ? null : (
        <p
          className={
            warned
              ? "border-warning/40 bg-warning/10 text-warning rounded-field border px-2.5 py-2 text-xs wrap-anywhere"
              : "text-xs opacity-60 wrap-anywhere"
          }
          data-testid="market-change-line"
        >
          {dated}
        </p>
      )}
    </Card>
  );
}
