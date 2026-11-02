// SPEC §5, board Setup — the parts setup's Connect step and `/setup/connect`
// both draw: the record to paste with its steps behind one press, doing it
// later, and the week that needs nothing more. daisyUI and lucide only.
"use client";

import type React from "react";
import Link from "next/link";
import { Check, ChevronDown, RefreshCcw } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import type { CheckWords } from "../../_destination/CheckConnection";
import { CnameRecord, CopyValue } from "../../_destination/CnameRecord";
import { QUIET } from "../frame";

/** Where doing it later leads. An internal route name, not a sentence. */
export const APP_PATH = "/app";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const BOX = "card border border-base-300 bg-base-100 shadow-(--shadow-card)";
const COPY_BUTTON = "btn btn-outline h-11 border-(--accent-line) bg-base-100 text-(length:--t-sm) text-primary";
const LATER = "btn btn-outline btn-block h-11 border-primary text-(length:--t-body) text-primary";

const STEPS = [
  "setup.connect.steps.1",
  "setup.connect.steps.2",
  "setup.connect.steps.3",
  "setup.connect.steps.4",
] as const satisfies readonly CopyKey[];

const WEEK_LINES = [
  "setup.connect.week.1",
  "setup.connect.week.2",
  "setup.connect.week.3",
  "setup.connect.week.4",
] as const satisfies readonly CopyKey[];

/** The press and its two answers, in board Setup's words. */
export const CHECK_WORDS: CheckWords = {
  button: "setup.connect.check",
  live: "setup.connect.connected",
  pending: "setup.connect.notfound",
  pendingTitle: "setup.connect.notfound.title",
  icon: RefreshCcw,
};

/** The site address a record sits under, and the record's name in it:
 *  `hostFor` composes every name as `<label>.<address>`. */
export function split(name: string): { label: string; address: string } {
  const dot = name.indexOf(".");
  return { label: name.slice(0, dot), address: name.slice(dot + 1) };
}

/** The record as three rows to copy, and the steps behind one press. `name`
 *  stands in the Name row's value where the founder still chooses the label. */
export function DnsCard(p: { record: DnsRecord; state?: HostnameState; name?: React.ReactNode }): React.JSX.Element {
  const { label, address } = split(p.record.name);
  const rows = [
    { field: copy("setup.destination.guide.field.type"), value: p.record.type, own: null },
    { field: copy("setup.destination.guide.field.name"), value: label, own: p.name ?? null },
    { field: copy("setup.destination.guide.field.value"), value: p.record.value, own: null },
  ];
  return (
    <section className={BOX} data-testid="setup-dns">
      <div className="card-body gap-2 p-5">
        <h2 className="text-(length:--t-body) font-bold wrap-anywhere">{copy("setup.connect.record.title", { domain: address })}</h2>
        <p className={`mb-1 ${QUIET}`}>{copy("setup.connect.record.usually")}</p>
        <div data-testid="setup-record">
          {rows.map((row) => (
            <div key={row.field} className="flex min-h-14 min-w-0 items-center gap-2 border-t border-base-300 py-1.5">
              <span className={`w-11 shrink-0 ${QUIET}`}>{row.field}</span>
              {row.own ?? <span className="num min-w-0 grow text-sm wrap-anywhere">{row.value}</span>}
              <CopyValue text={row.value} name={copy("setup.connect.record.copy", { field: row.field })} className={COPY_BUTTON} />
            </div>
          ))}
        </div>
        {/* daisyUI `collapse`, so a closed section lays out nothing that could escape it. */}
        <details className="group collapse min-w-0 rounded-none border-t border-base-300" data-testid="setup-connect-steps">
          <summary className="collapse-title flex min-h-11 items-center gap-2 p-0 text-sm font-semibold text-primary">
            <ChevronDown {...ICON} size={16} className="transition-transform group-open:rotate-180" />
            {copy("setup.connect.steps")}
          </summary>
          <div className="collapse-content grid min-w-0 gap-2.5 p-0 pb-2 text-(length:--t-sm)">
            <ol className="grid list-decimal gap-2 ps-5">
              {STEPS.map((step) => (
                <li key={step}>{copy(step)}</li>
              ))}
            </ol>
            {/* The provider's own steps, looked up from the address's nameservers. */}
            <details className="collapse min-w-0">
              <summary className="collapse-title link link-primary min-h-0 px-0 py-1">{copy("setup.connect.steps.guide")}</summary>
              <div className="collapse-content min-w-0 px-0">
                <CnameRecord record={p.record} {...(p.state === undefined ? {} : { state: p.state })} />
              </div>
            </details>
          </div>
        </details>
      </div>
    </section>
  );
}

/** Doing it later: a real way out, and the line saying why that is fine.
 *  `onLater` is setup's, which saves the step first; without it this is a plain link to the app. */
export function Later(p: { live: boolean; onLater?: () => void; busy?: boolean }): React.JSX.Element {
  const words = copy(p.live ? "setup.connect.onward.live" : "setup.connect.later");
  return (
    <div className="grid gap-2">
      {p.onLater === undefined ? (
        <Link className={LATER} href={APP_PATH} prefetch={true} data-testid="setup-connect-later-action">
          {words}
        </Link>
      ) : (
        <button type="button" className={LATER} disabled={p.busy} onClick={p.onLater} data-testid="setup-connect-later-action">
          {words}
        </button>
      )}
      {p.live ? null : (
        <p className={`text-center ${QUIET}`} data-testid="setup-connect-later">
          {copy("setup.connect.skipping")}
        </p>
      )}
    </div>
  );
}

/** The week after setup, which needs nothing more. */
export function WeekCard(): React.JSX.Element {
  return (
    <section className="card border border-(--ok-line) bg-(--ok-bg)" data-testid="setup-connect-week">
      <div className="card-body gap-4 p-5">
        <h2 className="text-(length:--h3)">{copy("setup.next.after")}</h2>
        <ul className="grid gap-3">
          {WEEK_LINES.map((line) => (
            <li key={line} className="flex gap-2.5">
              <Check {...ICON} size={20} className="mt-0.5 shrink-0 text-success" />
              <span>{copy(line)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
