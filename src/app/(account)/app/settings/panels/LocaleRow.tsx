// SPEC §6 (D66) — the country and language, changed after setup: setup's own
// list, the markets the site declares first. A save scans again at once.
"use client";

import type React from "react";
import { useId, useState, useTransition } from "react";
import { COUNTRIES, LANGUAGES, localeFromKey } from "@/lib/locale/locales";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { saveLocaleAction } from "../change-actions";
import { LOCALE_CHANGE_INITIAL, MARKET_LOCALE_FIELD, type LocaleChangeState } from "../market-state";
import type { SettingsModel } from "../model";
import { SettingRow } from "./SettingRow";

/** What the last save says, and whether it is a refusal. */
function answerLine(state: LocaleChangeState): { line: string | null; refused: boolean } | null {
  if (state.answer === "idle") return null;
  if (state.answer === "unchanged") return { line: writtenLine("settings.locale.unchanged"), refused: false };
  if (state.answer === "refused") return { line: writtenLine("settings.locale.refused"), refused: true };
  return state.remeasure.started
    ? { line: writtenLine("settings.market.remeasuring"), refused: false }
    : { line: state.remeasure.line, refused: true };
}

export function LocaleRow(p: { locale: SettingsModel["locale"] }): React.JSX.Element {
  const id = useId();
  const [state, setState] = useState<LocaleChangeState>(LOCALE_CHANGE_INITIAL);
  const [saving, startSaving] = useTransition();
  const said = answerLine(state);

  return (
    <SettingRow
      name={copy("setup.locale.label")}
      testId="setting-locale"
      below={
        <form
          action={(form) => startSaving(async () => setState(await saveLocaleAction(form)))}
          className="flex min-w-0 flex-col gap-2"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor={id} className="sr-only">
              {copy("setup.locale.label")}
            </label>
            <select id={id} name={MARKET_LOCALE_FIELD} className="select min-w-0 flex-1" defaultValue={p.locale.current}>
              {p.locale.options.map((key) => {
                const pair = localeFromKey(key);
                return pair === null ? null : (
                  <option key={key} value={key}>
                    {copy("setup.locale.option", {
                      country: COUNTRIES[pair.country].location,
                      language: LANGUAGES[pair.language].name,
                    })}
                  </option>
                );
              })}
            </select>
            <button type="submit" className="btn btn-soft btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
              {copy("settings.save")}
            </button>
          </div>
          <p className="text-xs text-base-content/70 wrap-anywhere">{copy("settings.locale.note")}</p>
          {said === null || said.line === null ? null : (
            <p
              className={`text-xs wrap-anywhere ${said.refused ? "text-error" : "text-base-content/70"}`}
              role={said.refused ? "alert" : undefined}
              data-testid="locale-answer"
            >
              {said.line}
            </p>
          )}
        </form>
      }
    />
  );
}
