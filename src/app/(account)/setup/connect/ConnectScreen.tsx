// SPEC §5 (2026-09-20, #908, #924) — the DNS record, after setup, in board
// Setup's order: the record to copy and the press that checks it, what
// happens after, doing it later, and the week that needs nothing more.
//
// The provider guides and the check are the blocks Settings draws
// (`CnameRecord`, `CheckConnection`): the guide sits behind *Show the steps*,
// and the check speaks this screen's words. *Do this later* is a real way
// out: the record stays on Overview and in Settings until the host is live.
//
// daisyUI in the route (DESIGN rule 1): `card`, `timeline`, `collapse`,
// `badge`, `btn`; lucide at stroke 1.75. Values wrap rather than scroll
// (#958).
"use client";

import type React from "react";
import Link from "next/link";
import { useState } from "react";
import { Check, Coffee, FileText, RefreshCcw, Search, type LucideIcon } from "lucide-react";
import { Surface } from "@/ui/layout";
import { ENTER_PUBLIC } from "@/ui/motion";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { CheckConnection, type CheckWords } from "../../_destination/CheckConnection";
import { CnameRecord, CopyValue } from "../../_destination/CnameRecord";

/** Where both ways out lead. An internal route name, not a sentence. */
const APP_PATH = "/app";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const QUIET = "text-sm text-base-content/70";

/** The three things that happen, in order: reserved is done, the founder
 *  waits on the middle one, and the last is what they wait for. */
const STAGES = [
  { id: "reserved", icon: Check, title: "setup.connect.stage.reserved", line: "setup.connect.stage.reserved.line" },
  { id: "waiting", icon: Search, title: "setup.connect.stage.waiting", line: "setup.connect.stage.waiting.line" },
  { id: "live", icon: FileText, title: "setup.connect.stage.live", line: "setup.connect.stage.live.line" },
] as const satisfies readonly { id: string; icon: LucideIcon; title: CopyKey; line: CopyKey }[];

const STEPS = [
  "setup.connect.steps.1",
  "setup.connect.steps.2",
  "setup.connect.steps.3",
  "setup.connect.steps.4",
] as const satisfies readonly CopyKey[];

const WEEK_LINES = ["setup.connect.week.1", "setup.connect.week.2", "setup.connect.week.3"] as const satisfies readonly CopyKey[];

const CHECK_WORDS: CheckWords = {
  button: "setup.connect.check",
  live: "setup.connect.connected",
  pending: "setup.connect.notfound",
  pendingTitle: "setup.connect.notfound.title",
  icon: RefreshCcw,
};

/** Monday to Sunday, in the screen's English (1 January 2024 was a Monday). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
);

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
    <div className={ENTER_PUBLIC}>
      <Surface
        arms={{
          compact: { kind: "columns", count: 1 },
          medium: { kind: "columns", count: 2 },
          wide: { kind: "same-as-below" },
        }}
      >
        <main className="grid min-w-0 grid-cols-1 content-start gap-6 p-4" data-testid="setup-connect" data-live={live}>
          <header className="grid min-w-0 gap-2">
            <p className="eyebrow" data-testid="setup-connect-eyebrow">
              {copy("setup.connect.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold">{copy("setup.connect.title")}</h1>
            <p className="max-w-prose text-sm text-base-content/70">{copy("setup.connect.lead")}</p>
            <span className="num min-w-0 text-sm wrap-anywhere" data-testid="setup-connect-host">
              {p.hostname}
            </span>
          </header>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="card card-border min-w-0 bg-base-100" data-testid="setup-dns">
              <div className="card-body gap-4 p-5">
                <h2 className="text-lg font-semibold wrap-anywhere">{copy("setup.connect.record.title", { domain: address })}</h2>
                <p className={QUIET}>{copy("setup.connect.record.usually")}</p>
                <div className="grid gap-2" data-testid="setup-record">
                  {rows.map((row) => (
                    <div key={row.field} className="flex min-w-0 items-center gap-3 rounded-box bg-base-200 px-3 py-2">
                      <span className={`w-12 shrink-0 ${QUIET}`}>{row.field}</span>
                      <span className="num min-w-0 grow wrap-anywhere">{row.value}</span>
                      <CopyValue text={row.value} name={copy("setup.connect.record.copy", { field: row.field })} />
                    </div>
                  ))}
                </div>
                <details className="collapse collapse-arrow bg-base-200" data-testid="setup-connect-steps">
                  <summary className="collapse-title text-sm font-medium">{copy("setup.connect.steps")}</summary>
                  <div className="collapse-content grid min-w-0 gap-3 text-sm">
                    <ol className="grid list-decimal gap-1 ps-5">
                      {STEPS.map((step) => (
                        <li key={step}>{copy(step)}</li>
                      ))}
                    </ol>
                    {/* The provider's own steps, looked up from the address's nameservers. */}
                    <details className="collapse min-w-0">
                      <summary className="collapse-title link link-primary min-h-0 px-0 py-1">{copy("setup.connect.steps.guide")}</summary>
                      <div className="collapse-content min-w-0 px-0">
                        <CnameRecord record={p.record} {...(state === undefined ? {} : { state })} />
                      </div>
                    </details>
                  </div>
                </details>
                {/* Only an answer that asked says anything about the host. */}
                <CheckConnection
                  draft={null}
                  words={CHECK_WORDS}
                  onAnswer={(answer) => {
                    if (answer.outcome === "asked") setState(answer.state);
                  }}
                />
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
              <section className="card card-border min-w-0 bg-base-100" data-testid="setup-connect-what">
                <div className="card-body gap-4 p-5">
                  <h2 className="eyebrow">{copy("setup.connect.what")}</h2>
                  {/* `timeline-compact`, not `timeline-snap-icon`: the two set one property and snap-icon wins. */}
                  <ul className="timeline timeline-vertical timeline-compact">
                    {STAGES.map((stage, index) => {
                      const done = index === 0 || (live && index === 2);
                      const current = !live && index === 1;
                      return (
                        <li key={stage.id} data-testid="setup-connect-stage" data-state={done ? "done" : current ? "current" : "pending"}>
                          {index === 0 ? null : <hr className={done ? "bg-primary" : ""} />}
                          <div className="timeline-middle">
                            <stage.icon
                              {...ICON}
                              size={16}
                              className={done ? "text-success" : current ? "text-primary" : "text-base-content/70"}
                            />
                          </div>
                          <p className="timeline-end mb-4 min-w-0 text-start">
                            <span className="block text-sm font-semibold">{copy(stage.title)}</span>
                            <span className="block text-xs text-base-content/70">{copy(stage.line)}</span>
                          </p>
                          {index === STAGES.length - 1 ? null : <hr className={done ? "bg-primary" : ""} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              <div className="grid gap-2">
                <Link className="btn btn-ghost btn-block" href={APP_PATH} prefetch={true} data-testid="setup-connect-later-action">
                  {copy(live ? "setup.connect.onward.live" : "setup.connect.later")}
                </Link>
                {live ? null : (
                  <p className={QUIET} data-testid="setup-connect-later">
                    {copy("setup.connect.skipping")}
                  </p>
                )}
              </div>

              <section className="card card-border min-w-0 bg-base-100" data-testid="setup-connect-week">
                <div className="card-body gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-box bg-success/10 text-success" aria-hidden>
                      <Coffee {...ICON} size={20} />
                    </span>
                    <h2 className="text-lg font-semibold">{copy("setup.next.after")}</h2>
                  </div>
                  <ol className="grid grid-cols-7 gap-1" aria-hidden>
                    {WEEKDAYS.map((day) => (
                      <li key={day} className="num grid justify-items-center gap-1 rounded-box bg-base-200 py-2 text-xs">
                        {day}
                        <FileText {...ICON} size={16} className="text-base-content/70" />
                      </li>
                    ))}
                  </ol>
                  <ul className="grid gap-2">
                    {WEEK_LINES.map((line) => (
                      <li key={line} className="flex gap-2 text-sm">
                        <Check {...ICON} size={18} className="mt-0.5 shrink-0 text-success" />
                        <span>{copy(line)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>

          <p className={`text-center ${QUIET}`} data-testid="setup-footer-line">
            {copy("setup.footer.line")}
          </p>
        </main>
      </Surface>
    </div>
  );
}
