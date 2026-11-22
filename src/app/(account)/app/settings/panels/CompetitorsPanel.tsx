// SPEC §4 *Market and competitors*: who the site is measured against, each with its first-page and AI-answer
// figures from the Competitors tab's readers, then the site itself. Add and remove go through `addRival` and
// `removeRival` on the server, under setup's rules; the set is never sent from the browser.
"use client";

import type React from "react";
import { BATTERY } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { BusinessScreen, CompetitorRow } from "../business-screen";
import { addRivalAction, removeRivalAction } from "../change-actions";
import { EditDialog, listChange, StagedList, type DialogAnswer } from "../EditDialog";
import { CARD, CARD_BODY, CARD_FOOT, CARD_LEAD, CARD_TITLE } from "../frame";
import { RIVAL_FIELD } from "../market-state";

type Competitors = NonNullable<BusinessScreen["competitors"]>;

/** Removals first, so a full set makes room; the first refused addition stops the save and says why. */
async function saveRivals(form: FormData, stored: readonly string[]): Promise<DialogAnswer> {
  const { added, removed } = listChange(form, RIVAL_FIELD, stored);
  const one = (domain: string): FormData => {
    const out = new FormData();
    out.set(RIVAL_FIELD, domain);
    return out;
  };
  try {
    for (const domain of removed) await removeRivalAction(one(domain));
    for (const domain of added) {
      const answer = await addRivalAction(one(domain));
      if (answer.answer === "refused") return { ok: false, line: writtenLine(answer.lineKey) ?? copy("settings.answer.refused") };
    }
  } catch {
    return { ok: false, line: copy("settings.answer.refused") };
  }
  return { ok: true };
}

function Figures(p: { row: CompetitorRow }): React.JSX.Element {
  return p.row.pending !== null ? (
    <td colSpan={2} className="text-base-content/70">
      {p.row.pending}
    </td>
  ) : (
    <>
      <td className="num">{p.row.google}</td>
      <td className="num">{p.row.ai}</td>
    </>
  );
}

export function CompetitorsPanel(p: { competitors: Competitors }): React.JSX.Element {
  const c = p.competitors;
  const domains = c.rows.map((row) => row.domain);
  const byDomain = new Map(c.rows.map((row) => [row.domain, row]));
  const head = (
    // daisyUI's head text is 60%: too faint to read; the card's quiet 70% is the floor.
    <tr className="whitespace-nowrap text-base-content/70">
      <th scope="col">{copy("settings.competitors.title")}</th>
      <th scope="col">{copy("settings.competitors.google")}</th>
      <th scope="col">{copy("settings.competitors.ai")}</th>
    </tr>
  );
  return (
    <section className={CARD} data-testid="settings-competitors">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <h2 className={CARD_TITLE}>{copy("settings.competitors.title")}</h2>
          <span className="num text-sm text-base-content/70" data-testid="competitor-count">
            {c.count}
          </span>
        </div>
        {c.none === null ? null : <p className={CARD_LEAD}>{c.none}</p>}
        {/* A table wider than a phone scrolls sideways, so the keyboard can reach it. */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={copy("settings.competitors.title")}>
          <table className="table-sm table min-w-0" data-testid="setting-competitors">
            <thead>{head}</thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.domain} data-testid={`competitor-${row.domain}`}>
                  <th scope="row" className="font-normal">
                    <span className="num break-all">{row.domain}</span>
                    {row.addedByYou ? <span className="badge badge-soft badge-primary badge-sm ms-2">{copy("settings.competitors.added")}</span> : null}
                  </th>
                  <Figures row={row} />
                </tr>
              ))}
              <tr className="font-semibold" data-testid="competitors-you">
                <th scope="row">{copy("settings.competitors.you")}</th>
                <td className="num">{c.you.google}</td>
                <td className="num">{c.you.ai}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {c.leaders === null ? null : (
          <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="competitors-leaders">
            {c.leaders}
          </p>
        )}
        <div className={CARD_FOOT}>
          <p className={CARD_LEAD}>{c.foot}</p>
          <EditDialog
            label={copy("settings.competitors.title")}
            lead={c.foot}
            testId="competitors-dialog"
            save={(form) => saveRivals(form, domains)}
          >
            <StagedList
              items={domains}
              name={RIVAL_FIELD}
              addLabel={copy("settings.competitors.add-label")}
              placeholder={copy("settings.competitors.placeholder")}
              max={BATTERY.COMPETITORS_MAX}
              full={copy("settings.competitors.full", { max: String(BATTERY.COMPETITORS_MAX) })}
              detail={(domain) => {
                const row = byDomain.get(domain);
                return row === undefined ? null : (
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/70">
                    {row.addedByYou ? <span className="badge badge-soft badge-primary badge-sm">{copy("settings.competitors.added")}</span> : null}
                    {row.detail}
                  </span>
                );
              }}
            />
            <p className="text-sm text-base-content/70 wrap-anywhere">{c.you.line}</p>
          </EditDialog>
        </div>
      </div>
    </section>
  );
}
