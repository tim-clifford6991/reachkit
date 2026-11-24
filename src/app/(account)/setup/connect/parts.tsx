// SPEC §5, board Setup — the parts setup's Connect step and `/setup/connect`
// both draw, as plate F7 lays them out: the record to paste with its steps and the web person behind one press, the
// week that needs nothing more, and the foot bar with doing it later beside the check. daisyUI and lucide only.
"use client";

import type React from "react";
import Link from "next/link";
import { Check, ChevronDown, RefreshCcw } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import type { CheckWords } from "../../_destination/CheckConnection";
import { CnameRecord, CopyValue, SendSteps } from "../../_destination/CnameRecord";
import { PRIMARY, QUIET, REGION } from "../frame";

/** Where doing it later leads. An internal route name, not a sentence. */
export const APP_PATH = "/app";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const BOX = "card border border-base-300 bg-base-100 shadow-(--shadow-card)";
const COPY_BUTTON = "btn btn-ghost btn-sm min-h-11 shrink-0 text-primary";
const LATER = "btn btn-ghost h-11 shrink-0 text-(length:--t-body) text-primary";
/** Two rows on a phone (doing it later over Back and the check), one row from `lg`, on the two columns' measure. */
const CONNECT_BAR = "mx-auto grid w-full max-w-[calc(var(--w-wide)+2rem)] min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 lg:flex";

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
            <div key={row.field} className="grid min-h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-t border-base-300 py-1.5 sm:grid-cols-[3rem_minmax(0,1fr)_auto]">
              <span className={`max-sm:col-span-2 ${QUIET}`}>{row.field}</span>
              {row.own ?? <span className="min-w-0 grow font-mono text-sm break-all">{row.value}</span>}
              <CopyValue text={row.value} field={row.field} name={copy("setup.connect.record.copy", { field: row.field })} className={COPY_BUTTON} />
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
                <CnameRecord record={p.record} send={false} {...(p.state === undefined ? {} : { state: p.state })} />
              </div>
            </details>
            <SendSteps host={p.record.name} />
          </div>
        </details>
      </div>
    </section>
  );
}

/** The bar's way out: later while waiting, onward once connected. */
const ONWARD = { later: "setup.connect.later", live: "setup.connect.onward.live" } as const satisfies Record<string, CopyKey>;

/** Doing it later, or going on once connected: setup's `onLater` saves the step first; without it this is a plain link to the app. */
function Onward(p: { words: CopyKey; className: string; onLater?: () => void; busy?: boolean }): React.JSX.Element {
  return p.onLater === undefined ? (
    <Link className={p.className} href={APP_PATH} data-testid="setup-connect-later-action">
      {copy(p.words)}
    </Link>
  ) : (
    <button type="button" className={p.className} disabled={p.busy} onClick={p.onLater} data-testid="setup-connect-later-action">
      {copy(p.words)}
    </button>
  );
}

/** The foot bar: Back, doing it later with the line saying why that is fine, and the check as the one primary.
 *  Once connected, going on is the primary and the press steps aside; `children` is the check, its answers beneath it. */
export function ConnectBar(p: {
  back?: React.ReactNode;
  live: boolean;
  onLater?: () => void;
  busy?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const onward = { ...(p.onLater === undefined ? {} : { onLater: p.onLater }), ...(p.busy === undefined ? {} : { busy: p.busy }) };
  return (
    <div className={CONNECT_BAR} data-frame={REGION.bar}>
      {p.back ?? null}
      {p.live ? null : (
        <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 max-lg:order-first lg:ms-auto">
          <p className={QUIET} data-testid="setup-connect-later">
            {copy("setup.connect.skipping")}
          </p>
          <Onward words={ONWARD.later} className={LATER} {...onward} />
        </div>
      )}
      <div className={`grid min-w-0 justify-items-end gap-2 ${p.back === undefined ? "col-span-2" : ""} ${p.live ? "lg:ms-auto" : ""}`}>
        {p.live ? <Onward words={ONWARD.live} className={PRIMARY} {...onward} /> : null}
        {p.children}
      </div>
    </div>
  );
}

/** The week after setup, which needs nothing more. `time` is the site's publish time; unread, its line is not drawn. */
export function WeekCard(p: { time: string | null }): React.JSX.Element {
  return (
    <section className="card border border-(--ok-line) bg-(--ok-bg)" data-testid="setup-connect-week">
      <div className="card-body gap-4 p-5">
        <h2 className="text-(length:--h3)">{copy("setup.next.after")}</h2>
        <ul className="grid gap-3">
          {WEEK_LINES.map((line) =>
            line === "setup.connect.week.2" && p.time === null ? null : (
              <li key={line} className="flex gap-2.5">
                <Check {...ICON} size={20} className="mt-0.5 shrink-0 text-success" />
                <span>{copy(line, { time: p.time ?? "" })}</span>
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
}
