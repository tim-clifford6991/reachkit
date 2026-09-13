// Canvas: Settings — the site and the market it is measured in: the domain
// and the category, each a row with the control that changes it.
//
// The consequence is the card's one written line, stated once for the card
// rather than twice for the two controls: both take effect at the next
// weekly re-measurement, so a second copy would be one fact pretending to
// be two.
//
// This card decides nothing about a change. What a save writes and when it
// takes effect are `@/lib/market/changes`'s, and which line the card states
// is `../model`'s `marketChange` — asked again with the field the customer
// has open.
//
// One field at a time: opening the second closes the first, because the
// card states one dated line and two open fields would be two answers typed
// against one sentence.
"use client";

import type React from "react";
import { Globe } from "lucide-react";
import { useState } from "react";
import { Btn, Card, Input } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { saveCategoryAction, saveDomainAction } from "../change-actions";
import { SettingRow } from "./SettingRow";
import {
  MARKET_CATEGORY_FIELD,
  MARKET_CHANGE_INITIAL,
  MARKET_DOMAIN_FIELD,
  refusalKeyOf,
  savedInstantOf,
  type MarketChangeState,
} from "../market-state";
import { marketChange, type SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  CONTROLS,
  EXPLAIN,
  GLYPH,
  SECTION,
  STACK,
  STEP_WARN,
  STROKE,
  VALUE,
} from "../style";

/** The two answers this card changes — `../model`'s own union, so a third
 *  declared answer cannot appear here without appearing there. */
type Answer = "domain" | "category";

/** Which action, which wire name and which label each field carries. One
 *  record rather than two branches: they differ in nothing else. */
const FIELD: Record<
  Answer,
  {
    action: (form: FormData) => Promise<MarketChangeState>;
    name: string;
    labelKey: "settings.market.domain" | "settings.market.category";
  }
> = {
  domain: { action: saveDomainAction, name: MARKET_DOMAIN_FIELD, labelKey: "settings.market.domain" },
  category: {
    action: saveCategoryAction,
    name: MARKET_CATEGORY_FIELD,
    labelKey: "settings.market.category",
  },
};

export function MarketPanel(p: {
  market: SettingsModel["market"];
  domain: string;
  /** The stated zone — the one this card writes a date in when a save
   *  answers before the re-read comes back. */
  timeZone: string;
}): React.JSX.Element {
  /** Which answer has a field open, and what is in it. `null` is this
   *  card's ordinary state: nothing is being changed. */
  const [editing, setEditing] = useState<Answer | null>(null);
  // The typed value, kept across a refusal: an uncontrolled field would be
  // cleared by React's own post-action form reset.
  const [value, setValue] = useState("");
  /** What the last press answered. Held here rather than in
   *  `useActionState`, so pressing Edit again asks a fresh question. */
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
    // A save closes the field; a refusal keeps it open, with the value
    // intact and the reason on it.
    if (next.answer === "saved") setEditing(null);
    if (next.answer === "refused") setValue(next.value);
  }

  // One written line either way: a dated one while a change stands or is
  // being typed, the card's standing one otherwise. A save that has just
  // answered outranks both, because the revalidated read has not come back.
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

  // A function returning elements, deliberately not a component declared
  // here: a nested component is a new type on every render, so React would
  // remount the field on each keystroke and the caret would be lost.
  function editingField(answer_: Answer): React.JSX.Element {
    const field = FIELD[answer_];
    return (
      <form action={submit} className={STACK} data-testid={`edit-${answer_}`}>
        {/* Two calls, not one with a spread: `InputProps` is a union in
            which `invalid` and `invalidMessage` arrive together. */}
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
        <div className={CONTROLS}>
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
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Globe size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.market.title")}</span>
          </span>
        </div>
      }
    >
      {/* The site first and the market second: the card is "Your site &
          market", and the domain is the thing the market is derived for. */}
      <div className={SECTION}>
        <SettingRow
          name={copy("settings.market.domain")}
          testId="setting-domain"
          below={editing === "domain" ? editingField("domain") : null}
        >
          {editing === "domain" ? null : (
            <>
              <span className={VALUE}>{p.domain}</span>
              <Btn
                label={copy("settings.change")}
                size="sm"
                variant="secondary"
                pill
                onClick={() => open("domain")}
              />
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
              {/* A search query and the buyer vocabulary it is written in
                  are code-like strings, so the value is mono. */}
              <span className={VALUE}>{p.market.category}</span>
              <Btn
                label={copy("settings.edit")}
                size="sm"
                variant="secondary"
                pill
                onClick={() => open("category")}
              />
            </>
          )}
        </SettingRow>
      </div>

      {effect === null ? null : <p className={EXPLAIN}>{effect}</p>}
      {dated === null ? null : (
        <p className={warned ? STEP_WARN : EXPLAIN} data-testid="market-change-line">
          {dated}
        </p>
      )}
    </Card>
  );
}
