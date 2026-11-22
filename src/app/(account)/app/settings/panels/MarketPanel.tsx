// SPEC §4 *Market and competitors* and *A changed market is measured now*: the website, the market and the country
// each change in a dialog through `../change-actions.ts`, the only writers of a declared answer. A changed market
// starts a pass at once and says so; a website change lands at the weekly pass, dated before the Save.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { say } from "@/app/_toast/say";
import { AlsoServesNote } from "@/app/_business/WhatWeRead";
import { COUNTRIES, LANGUAGES, localeFromKey } from "@/lib/locale/locales";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import type { BusinessScreen, Line } from "../business-screen";
import { remeasureNowAction, saveCategoryAction, saveDomainAction, saveLocaleAction } from "../change-actions";
import { EditDialog, TextField, type DialogAnswer } from "../EditDialog";
import { CARD, CARD_BODY, CARD_FOOT, CARD_LEAD, CARD_TITLE, SOFT } from "../frame";
import {
  MARKET_CATEGORY_FIELD,
  MARKET_DOMAIN_FIELD,
  MARKET_LOCALE_FIELD,
  MARKET_REMEASURE_INITIAL,
  type MarketChangeState,
  type MarketRemeasureState,
} from "../market-state";
import type { SettingsModel } from "../model";
import { SettingLine } from "./SettingRow";

const REFUSED = (): DialogAnswer => ({ ok: false, line: copy("settings.answer.refused") });

/** What a website or market save answered, as the dialog states it. */
function answered(state: MarketChangeState, timeZone: string): DialogAnswer {
  if (state.answer === "refused") return { ok: false, line: writtenLine(state.lineKey) ?? copy("settings.answer.refused") };
  if (state.answer !== "saved") return REFUSED();
  if (state.remeasure !== undefined) {
    return { ok: true, said: state.remeasure.started ? writtenLine("settings.market.remeasuring") : state.remeasure.line };
  }
  if (state.note !== undefined) {
    return { ok: true, said: writtenLine(state.note === "unchanged" ? "settings.market.category.unchanged" : "settings.market.category.cleared") };
  }
  return { ok: true, said: writtenLine("settings.market.effectiveOn", { date: formatShortDay(new Date(state.effectiveOn), timeZone) }) };
}

/** The market, then the country and language: a refusal of either keeps the dialog open; a changed country speaks
 *  for itself, else the market's own answer is the one said. */
async function saveMarket(form: FormData, timeZone: string): Promise<DialogAnswer> {
  const market = answered(await saveCategoryAction(form).catch(() => ({ answer: "idle" }) as const), timeZone);
  if (!market.ok) return market;
  const state = await saveLocaleAction(form).catch(() => null);
  if (state === null || state.answer === "idle") return REFUSED();
  if (state.answer === "refused") return { ok: false, line: writtenLine("settings.locale.refused") ?? copy("settings.answer.refused") };
  if (state.answer === "unchanged") return market;
  return { ok: true, said: state.remeasure.started ? writtenLine("settings.market.remeasuring") : market.said ?? state.remeasure.line };
}

/** *Check My Market Now*: the same pass and bound as a changed market; a refusal says why beside the button. */
function CheckNow(p: { next: string }): React.JSX.Element {
  const [answer, setAnswer] = useState<MarketRemeasureState>(MARKET_REMEASURE_INITIAL);
  const [measuring, start] = useTransition();
  function press(): void {
    start(async () => {
      const next = await remeasureNowAction().catch((): MarketRemeasureState => ({ answer: "refused", line: copy("settings.answer.could-not-ask") }));
      if (next.answer === "started") {
        setAnswer(MARKET_REMEASURE_INITIAL);
        const line = writtenLine("settings.market.remeasure.started");
        if (line !== null) say(line, "ok");
      } else setAnswer(next);
    });
  }
  return (
    <div className={CARD_FOOT} data-testid="market-remeasure">
      <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="market-next">
        {p.next}
      </p>
      <button type="button" className={SOFT} disabled={measuring} onClick={press} data-testid="market-remeasure-press">
        {measuring ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <RefreshCw size={16} strokeWidth={1.75} aria-hidden />}
        {copy("settings.market.remeasure.action")}
      </button>
      {answer.answer === "refused" ? (
        <p className="w-full text-sm text-error wrap-anywhere" role="alert" data-testid="market-remeasure-line">
          {answer.line}
        </p>
      ) : null}
    </div>
  );
}

export function MarketPanel(p: {
  market: NonNullable<BusinessScreen["market"]>;
  domain: string;
  category: string;
  locale: SettingsModel["locale"];
  /** How many other markets the site declares, said in the Your market dialog. */
  alsoServes: number | undefined;
  /** The site's own market, not one the founder set: its dialog says it is read from the site. */
  overridden: boolean;
  timeZone: string;
}): React.JSX.Element {
  function action(line: Line): React.ReactNode {
    switch (line.id) {
      case "domain":
        return (
          <EditDialog
            label={line.label}
            lead={p.market.domainLead}
            testId="setting-domain-dialog"
            save={async (form) => answered(await saveDomainAction(form).catch(() => ({ answer: "idle" }) as const), p.timeZone)}
          >
            <div data-testid="edit-domain">
              <TextField name={MARKET_DOMAIN_FIELD} label={line.label} value={p.domain} />
            </div>
          </EditDialog>
        );
      case "category":
        // Where your buyers are is this dialog's second field; each save keeps its own answer.
        return (
          <EditDialog
            label={line.label}
            lead={writtenLine("settings.market.category.starts-now")}
            testId="setting-category-dialog"
            save={(form) => saveMarket(form, p.timeZone)}
          >
            <TextField name={MARKET_CATEGORY_FIELD} label={line.label} value={p.category} />
            <p className={CARD_LEAD}>{copy(p.overridden ? "settings.market.overridden" : "settings.market.consequence.market")}</p>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">{copy("setup.locale.label")}</span>
              <select name={MARKET_LOCALE_FIELD} className="select w-full min-w-0" defaultValue={p.locale.current}>
                {p.locale.options.map((key) => {
                  const pair = localeFromKey(key);
                  return pair === null ? null : (
                    <option key={key} value={key}>
                      {copy("setup.locale.option", { country: COUNTRIES[pair.country].location, language: LANGUAGES[pair.language].name })}
                    </option>
                  );
                })}
              </select>
            </label>
            <p className={CARD_LEAD}>{copy("settings.locale.note")}</p>
            <AlsoServesNote n={p.alsoServes} />
          </EditDialog>
        );
      default:
        return null;
    }
  }

  return (
    <section className={CARD} data-testid="settings-market">
      <div className={CARD_BODY}>
        <h2 className={CARD_TITLE}>{copy("settings.market.title")}</h2>
        <div className="flex min-w-0 flex-col">
          {p.market.lines.map((line) => (
            <SettingLine key={line.id} label={line.label} value={line.value} testId={`setting-${line.id}`} action={action(line)} />
          ))}
        </div>
        {p.market.checked === null ? null : (
          <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="market-sets">
            {p.market.checked}
          </p>
        )}
        {p.market.standing === null ? null : (
          <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="market-change-line">
            {p.market.standing}
          </p>
        )}
        <CheckNow next={p.market.next} />
      </div>
    </section>
  );
}
