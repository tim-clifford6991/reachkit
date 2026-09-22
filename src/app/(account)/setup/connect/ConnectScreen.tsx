// SPEC §5 (2026-09-20, #908, #924) — "Connect your blog's address".
//
// The DNS record as its own step **after** setup, with *Do this later*.
// This reverses the 2026-09-16 ruling (#757) that it be completed on the
// setup page: setup finishes without it, and a founder who wants to do it
// now does it here.
//
// **Nothing on this screen is new machinery.** The numbered steps, the
// provider lookup, the record table and its copy buttons are
// `_destination/CnameRecord.tsx`'s — the same block Settings draws — and
// the check with its countdown is `CheckConnection.tsx`'s. What this file
// adds is the frame, the two ways onward, and the three-item account of
// what happens while the founder does it.
//
// **Both ways onward lead to the app.** *Do this later* is not a lesser
// path: the alert under the timeline says so in words, and the record stays
// reachable from Overview's needs-you and from Settings until the host is
// live. A founder who presses *Check the connection* and sees it go live
// reads that on the timeline and then leaves by the same door.
//
// daisyUI in the route (DESIGN rule 1): `steps`, `timeline`, `alert`,
// `btn`; lucide at stroke 1.75. No stylesheet, no wrapper.
//
// **It cannot overflow.** One column below `lg` and two above it; the host
// is a value and is never clamped — it wraps at any character rather than
// sitting in a scroller, because a value pushed off the edge of a scroller
// is one a phone user never sees (the owner's ruling on #958).
"use client";

import type React from "react";
import { useState } from "react";
import { ArrowRight, Check, Circle } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { CheckConnection } from "../../_destination/CheckConnection";
import { CnameRecord } from "../../_destination/CnameRecord";

/** Where both controls lead. An internal route name, not a sentence. */
const APP_PATH = "/app";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

/** The three things that happen, in order. The middle one is where the
 *  founder is until the record resolves; the last is what they are waiting
 *  for. Each is a pair of keys — a title and the line under it — so this
 *  file composes no sentence. */
const STAGES = [
  { id: "reserved", title: "setup.connect.stage.reserved", line: "setup.connect.stage.reserved.line" },
  { id: "waiting", title: "setup.connect.stage.waiting", line: "setup.connect.stage.waiting.line" },
  { id: "live", title: "setup.connect.stage.live", line: "setup.connect.stage.live.line" },
] as const satisfies readonly { id: string; title: CopyKey; line: CopyKey }[];

export function ConnectScreen(p: {
  hostname: string;
  record: DnsRecord;
}): React.JSX.Element {
  // What the founder's own press last said. `undefined` is "not asked" —
  // the timeline then stands on "waiting", which is what the row says.
  const [state, setState] = useState<HostnameState | undefined>(undefined);
  const live = state === "live";

  return (
    <div className="grid min-h-svh grid-rows-[1fr_auto]">
      <Surface
        arms={{
          compact: { kind: "columns", count: 1 },
          medium: { kind: "columns", count: 2 },
          wide: { kind: "same-as-below" },
        }}
      >
        <main
          className="grid min-w-0 grid-cols-1 content-start gap-6 p-4 pb-28"
          data-testid="setup-connect"
          data-live={live}
        >
          <header className="grid min-w-0 gap-2">
            <p className="eyebrow" data-testid="setup-connect-eyebrow">
              {copy("setup.connect.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold">{copy("setup.connect.title")}</h1>
            <p className="max-w-prose text-sm text-base-content/70">
              {copy("setup.connect.lead")}
            </p>
            {/* The host is a value: never clamped, never cut, and never in
                a scroller — a long one wraps where it must. */}
            <span className="num min-w-0 text-sm wrap-anywhere" data-testid="setup-connect-host">
              {p.hostname}
            </span>
          </header>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            {/* The record block, under the name it has carried since it
                stood on the publishing step: what a founder is told to
                create, and the control that checks it. */}
            <div className="grid min-w-0 content-start gap-4" data-testid="setup-dns">
              <CnameRecord record={p.record} {...(state === undefined ? {} : { state })} />
              {/* Only an answer that actually asked says anything about
                  the host. "Too soon", "could not ask" and a refusal each
                  say something about the *request*, and the timeline is
                  about the record — so they leave it where it was, which
                  is what the row still says. */}
              <CheckConnection
                draft={null}
                onAnswer={(answer) => {
                  if (answer.outcome === "asked") setState(answer.state);
                }}
              />
            </div>

            <aside className="grid min-w-0 content-start gap-4" data-testid="setup-connect-what">
              <section className="card card-border min-w-0 bg-base-100">
                <div className="card-body gap-4 p-5">
                  <h2 className="eyebrow">{copy("setup.connect.what")}</h2>
                  {/* `timeline-compact` and not `timeline-snap-icon`: the two set the
                      same custom property, and snap-icon wins by order — it
                      would leave an empty column where a start side would be. */}
                  <ul className="timeline timeline-vertical timeline-compact">
                    {STAGES.map((stage, index) => {
                      // Reserved is done the moment the label is theirs.
                      // Waiting is where they are until a check says live,
                      // and then live is done and waiting is behind them.
                      const done = index === 0 || (live && index === 2);
                      const current = !live && index === 1;
                      return (
                        <li key={stage.id} data-testid="setup-connect-stage" data-state={done ? "done" : current ? "current" : "pending"}>
                          {index === 0 ? null : <hr className={done ? "bg-primary" : ""} />}
                          <div className="timeline-middle">
                            {done ? (
                              <Check {...ICON} size={16} className="text-success" />
                            ) : current ? (
                              <span className="loading loading-dots loading-xs text-primary" aria-hidden />
                            ) : (
                              <Circle {...ICON} size={14} className="text-base-content/40" />
                            )}
                          </div>
                          <div className="timeline-end mb-4 min-w-0 text-start">
                            <p className="text-sm font-semibold">{copy(stage.title)}</p>
                            <p className="text-xs text-base-content/60">{copy(stage.line)}</p>
                          </div>
                          {index === STAGES.length - 1 ? null : <hr className={done ? "bg-primary" : ""} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              <div role="note" className="alert alert-soft text-sm" data-testid="setup-connect-later">
                {copy("setup.connect.skipping")}
              </div>
            </aside>
          </div>
        </main>
      </Surface>

      {/* The action bar, outside the `Surface` so it runs edge to edge on a
          phone — the frame #938 gives every setup screen. A `<footer>` for
          the reason `SetupForm.tsx` gives at the same row (#328): outside
          `<main>` by design, and so content in no landmark until it says
          which one it is. */}
      <footer className="sticky bottom-0 border-t border-base-300 bg-base-100">
        <div className="mx-auto flex min-w-0 max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
          <a className="btn btn-ghost" href={APP_PATH} data-testid="setup-connect-later-action">
            {copy("setup.connect.later")}
          </a>
          <a className="btn btn-primary" href={APP_PATH} data-testid="setup-connect-done">
            {copy(live ? "setup.connect.onward.live" : "setup.connect.onward")}
            <ArrowRight {...ICON} size={16} />
          </a>
        </div>
      </footer>
    </div>
  );
}
