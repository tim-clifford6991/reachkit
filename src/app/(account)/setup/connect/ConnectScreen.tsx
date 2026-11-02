// SPEC §5 (2026-09-20, #908, #924) — the DNS record, after setup, in board
// Setup's order: the record to copy, doing it later, the week that needs
// nothing more, and the press that checks it in the bar at the foot.
//
// The provider guides and the check are the blocks Settings draws
// (`CnameRecord`, `CheckConnection`): the guide sits behind *Show the steps*,
// and the check speaks this screen's words. *Do this later* is a real way
// out: the record stays on Overview and in Settings until the host is live.
//
// daisyUI in the route (DESIGN rule 1); lucide at stroke 1.75. Values wrap
// rather than scroll (#958).
"use client";

import type React from "react";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, RefreshCcw } from "lucide-react";
import { Surface } from "@/ui/layout";
import { ENTER_PUBLIC } from "@/ui/motion";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { CheckConnection, type CheckWords } from "../../_destination/CheckConnection";
import { CnameRecord, CopyValue } from "../../_destination/CnameRecord";
import { BAR, BAR_INNER, BODY, FRAME, PRIMARY, QUESTION_HEAD, QUIET, SETUP_ARMS } from "../frame";
import { SetupHeader } from "../SetupHeader";

/** The step this screen finishes: a step handle, not a sentence. */
const STEP = "publishing" as const;

/** Where both ways out lead. An internal route name, not a sentence. */
const APP_PATH = "/app";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const BOX = "card border border-base-300 bg-base-100 shadow-(--shadow-card)";

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

const CHECK_WORDS: CheckWords = {
  button: "setup.connect.check",
  live: "setup.connect.connected",
  pending: "setup.connect.notfound",
  pendingTitle: "setup.connect.notfound.title",
  icon: RefreshCcw,
};

/** The site address a record sits under, and the record's name in it:
 *  `hostFor` composes every name as `<label>.<address>`. */
function split(name: string): { label: string; address: string } {
  const dot = name.indexOf(".");
  return { label: name.slice(0, dot), address: name.slice(dot + 1) };
}

export function ConnectScreen(p: { hostname: string; record: DnsRecord }): React.JSX.Element {
  // What the founder's own press last said; `undefined` is "not asked".
  const [state, setState] = useState<HostnameState | undefined>(undefined);
  const live = state === "live";
  const { label, address } = split(p.record.name);
  const rows = [
    { field: copy("setup.destination.guide.field.type"), value: p.record.type },
    { field: copy("setup.destination.guide.field.name"), value: label },
    { field: copy("setup.destination.guide.field.value"), value: p.record.value },
  ];

  return (
    <div className={`${ENTER_PUBLIC} ${FRAME}`}>
      <SetupHeader step={STEP} />
      <Surface arms={SETUP_ARMS}>
        <main className={BODY} data-testid="setup-connect" data-live={live} data-host={p.hostname}>
          <div className={QUESTION_HEAD}>
            <h1 className="text-(length:--h1) leading-tight tracking-[-0.03em]">{copy("setup.connect.title")}</h1>
            <p className="text-base-content/80">{copy("setup.step.publishing.line")}</p>
          </div>

          <section className={BOX} data-testid="setup-dns">
            <div className="card-body gap-2 p-5">
              <h2 className="text-(length:--t-body) font-bold wrap-anywhere">{copy("setup.connect.record.title", { domain: address })}</h2>
              <p className={`mb-1 ${QUIET}`}>{copy("setup.connect.record.usually")}</p>
              <div data-testid="setup-record">
                {rows.map((row) => (
                  <div key={row.field} className="flex min-h-14 min-w-0 items-center gap-2 border-t border-base-300 py-1.5">
                    <span className={`w-11 shrink-0 ${QUIET}`}>{row.field}</span>
                    <span className="num min-w-0 grow text-sm wrap-anywhere">{row.value}</span>
                    <CopyValue
                      text={row.value}
                      name={copy("setup.connect.record.copy", { field: row.field })}
                      className="btn btn-outline h-11 border-(--accent-line) bg-base-100 text-(length:--t-sm) text-primary"
                    />
                  </div>
                ))}
              </div>
              <details className="group border-t border-base-300 pt-1" data-testid="setup-connect-steps">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary">
                  <ChevronDown {...ICON} size={16} className="transition-transform group-open:rotate-180" />
                  {copy("setup.connect.steps")}
                </summary>
                <div className="grid min-w-0 gap-2.5 pt-1 pb-2 text-(length:--t-sm)">
                  <ol className="grid list-decimal gap-2 ps-5">
                    {STEPS.map((step) => (
                      <li key={step}>{copy(step)}</li>
                    ))}
                  </ol>
                  {/* The provider's own steps, looked up from the address's nameservers. */}
                  <details className="min-w-0">
                    <summary className="link link-primary cursor-pointer list-none">{copy("setup.connect.steps.guide")}</summary>
                    <div className="min-w-0 pt-2">
                      <CnameRecord record={p.record} {...(state === undefined ? {} : { state })} />
                    </div>
                  </details>
                </div>
              </details>
            </div>
          </section>

          <div className="grid gap-2">
            <Link
              className="btn btn-outline btn-block h-11 border-primary text-(length:--t-body) text-primary"
              href={APP_PATH}
              prefetch={true}
              data-testid="setup-connect-later-action"
            >
              {copy(live ? "setup.connect.onward.live" : "setup.connect.later")}
            </Link>
            {live ? null : (
              <p className={`text-center ${QUIET}`} data-testid="setup-connect-later">
                {copy("setup.connect.skipping")}
              </p>
            )}
          </div>

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
        </main>
      </Surface>

      {/* The press is the screen's one primary, pinned in the bar like every setup step's (SPEC §5). */}
      <footer className={BAR}>
        <div className={BAR_INNER}>
          <div className="grid min-w-0 flex-1">
            {/* Only an answer that asked says anything about the host. */}
            <CheckConnection
              draft={null}
              words={CHECK_WORDS}
              pressClass={`${PRIMARY} self-end`}
              onAnswer={(answer) => {
                if (answer.outcome === "asked") setState(answer.state);
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
