// SPEC §7 *Content we already know about*: the index's counts in one line and its addresses behind *Show*. It offers
// no control: the index is re-read on a WordPress connect and every Monday, so a rebuild button would answer nothing new.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { KnownContentCounts } from "../business-provider";
import { EditDialog } from "../EditDialog";
import { CARD, CARD_BODY, CARD_LEAD, CARD_TITLE } from "../frame";
import { SettingLine } from "./SettingRow";

/** A read-only list behind *Show*: one address a row, wrapped, scrolling inside the dialog. */
export function ShowList(p: { label: string; testId: string; rows: readonly { key: string; text: React.ReactNode; line?: string }[] }): React.JSX.Element {
  return (
    <EditDialog label={p.label} testId={p.testId} show>
      <ul className="list min-w-0 overflow-y-auto">
        {p.rows.map((row) => (
          <li key={row.key} className="list-row min-w-0 flex-col items-start gap-1 px-0">
            <span className="min-w-0 font-mono text-sm break-all">{row.text}</span>
            {row.line === undefined ? null : <span className="text-xs text-base-content/70 wrap-anywhere">{row.line}</span>}
          </li>
        ))}
      </ul>
    </EditDialog>
  );
}

export function KnownContentPanel(p: { known: KnownContentCounts }): React.JSX.Element {
  const { known } = p;
  const label = copy("settings.known.head");
  const none = known.pages.length === 0;
  const value = none
    ? copy("settings.none")
    : `${copy("settings.known.ours", { count: String(known.ours) })} · ${copy("settings.known.site", { count: String(known.site) })}`;
  return (
    <section className={CARD} data-testid="settings-known-content">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-col">
          <h2 className={CARD_TITLE}>{label}</h2>
          <p className={CARD_LEAD}>{copy("settings.known.note")}</p>
        </div>
        <SettingLine
          label={label}
          value={none ? { kind: "empty", text: value } : { kind: "text", text: value, full: value }}
          testId="settings-known-total"
          action={none ? null : <ShowList label={label} testId="settings-known-dialog" rows={known.pages.map((page) => ({ key: page, text: page }))} />}
        />
      </div>
    </section>
  );
}
