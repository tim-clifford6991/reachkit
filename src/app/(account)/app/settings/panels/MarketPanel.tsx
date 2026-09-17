// BUILD §4.7 — "**Your market** (chip + Edit + 'changing this rebuilds the
// search set and the 12 questions next Monday')".
//
// Two of the settable keys live here: `category`, which §4.7 draws as
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
import { Globe } from "lucide-react";
import { useState } from "react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { remeasureNowAction, saveCategoryAction, saveDomainAction } from "../change-actions";
import { SettingRow } from "./SettingRow";
import {
  MARKET_CATEGORY_FIELD,
  MARKET_CHANGE_INITIAL,
  MARKET_DOMAIN_FIELD,
  MARKET_REMEASURE_INITIAL,
  refusalKeyOf,
  savedInstantOf,
  type MarketChangeState,
  type MarketRemeasureState,
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
  /** Issue 866's standalone measurement: what the last press answered. It
   *  changes no stored answer, so it has no field and no value to keep. */
  const [remeasure, setRemeasure] = useState<MarketRemeasureState>(MARKET_REMEASURE_INITIAL);

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

  /**
   * What the last press did to the market's own measurement (issue 866).
   *
   * A category is measured again at once, so the card states that
   * measurement — started, refused, or not needed — and never REQ-071 c6's
   * date, which is the weekly pass and is not what a category waits for. A
   * domain save has none of these and keeps the dated line.
   */
  const measured: string | null =
    answer.answer !== "saved"
      ? null
      : answer.remeasure?.started === true
        ? writtenLine("settings.market.remeasuring")
        : answer.remeasure?.started === false
          ? answer.remeasure.line
          : answer.note === "unchanged"
            ? writtenLine("settings.market.category.unchanged")
            : answer.note === "cleared"
              ? writtenLine("settings.market.category.cleared")
              : null;
  const touchedCategory = answer.answer === "saved" && (answer.remeasure !== undefined || answer.note !== undefined);

  const dated =
    measured !== null
      ? measured
      : // A category save that answered says what it did, above; a category
        // save that answered nothing states nothing rather than a Monday.
        touchedCategory
        ? null
        : justSaved !== null
          ? effectiveLine(formatDate(new Date(justSaved), p.timeZone))
          : change === null
            ? null
            : change.kind === "category"
              ? // Issue 866: a saved category no pass has adopted yet. It is
                // measured again by the control below, not on a Monday — so
                // the line offers that and names the weekly pass only as the
                // fallback it is. A category still being typed has its own
                // line above (`starts-now`) and none here.
                change.saved
                ? writtenLine("settings.market.category.not-measured-yet", { date: change.on })
                : null
              : change.saved
                ? effectiveLine(change.on)
                : writtenLine("settings.market.pending", {
                    date: change.on,
                    change: copy(change.changeKey),
                  });
  const warned = justSaved === null && change?.saved === false && change.kind !== "category";
  const effect =
    editing === "category"
      ? // Issue 866, in place of REQ-071 c1's dated line: saving a different
        // category measures the market again at once, and what that costs is
        // said before the press.
        writtenLine("settings.market.category.starts-now")
      : change === null && justSaved === null
        ? writtenLine("settings.market.effect")
        : null;

  /** What the standalone control says: what it will do until it is pressed,
   *  then what that press answered. */
  const remeasureLine =
    remeasure.answer === "started"
      ? writtenLine("settings.market.remeasure.started")
      : remeasure.answer === "refused"
        ? remeasure.line
        : writtenLine("settings.market.remeasure.effect");

  async function pressRemeasure(): Promise<void> {
    setRemeasure(await remeasureNowAction());
  }

  const refusal = refusalKeyOf(answer);
  const refusalLine = refusal === null ? null : writtenLine(refusal);

  // A function that returns elements, deliberately **not** a component
  // declared here: a nested component is a new type on every render, so
  // React would unmount and remount the field on each keystroke and the
  // customer would lose the caret after every character.
  function editingField(answer_: Answer): React.JSX.Element {
    const field = FIELD[answer_];
    return (
      <form action={submit} className="flex min-w-0 flex-col gap-2" data-testid={`edit-${answer_}`}>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-base-content/70">{copy(field.labelKey)}</span>
          <input
            className={refusalLine === null ? "input num w-full" : "input input-error num w-full"}
            name={field.name}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={refusalLine !== null}
          />
        </label>
        {refusalLine === null ? null : <p className="text-xs text-error wrap-anywhere">{refusalLine}</p>}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary btn-sm">
            {copy("settings.save")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
            {copy("settings.cancel-edit")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <Globe size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.market.title")}
        </h2>

        {/* The site first, the market second: the market is derived for the
            domain. An open field sits under its row. */}
        <div className="flex min-w-0 flex-col">
          <SettingRow
            name={copy("settings.market.domain")}
            testId="setting-domain"
            below={editing === "domain" ? editingField("domain") : null}
          >
            {editing === "domain" ? null : (
              <>
                <span className="num min-w-0 wrap-anywhere">{p.domain}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open("domain")}>
                  {copy("settings.change")}
                </button>
              </>
            )}
          </SettingRow>

          <SettingRow
            name={copy("settings.market.category")}
            testId="setting-category"
            below={editing === "category" ? editingField("category") : null}
          >
            {editing === "category" ? null : (
              <>
                <span className="num min-w-0 wrap-anywhere">{p.market.category}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open("category")}>
                  {copy("settings.edit")}
                </button>
              </>
            )}
          </SettingRow>
        </div>

        {/* Issue 866: the plain way to measure the market again — the same
            pass the thin-market choice starts, under the same daily bound.
            Outline rather than solid: this screen's one fill is a Save. */}
        <div className="flex min-w-0 flex-col gap-2" data-testid="market-remeasure">
          <form action={pressRemeasure}>
            <button type="submit" className="btn btn-outline btn-sm" data-testid="market-remeasure-press">
              {copy("settings.market.remeasure.action")}
            </button>
          </form>
          {remeasureLine === null ? null : (
            <p className="text-xs text-base-content/60 wrap-anywhere" data-testid="market-remeasure-line">
              {remeasureLine}
            </p>
          )}
        </div>

        {effect === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{effect}</p>}
        {dated === null ? null : (
          <p
            className={
              warned
                ? "alert alert-warning alert-soft text-xs wrap-anywhere"
                : "text-xs text-base-content/60 wrap-anywhere"
            }
            data-testid="market-change-line"
          >
            {dated}
          </p>
        )}
      </div>
    </section>
  );
}
