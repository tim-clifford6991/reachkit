// BUILD §4.1 — the report's one re-measure control, which re-measures (#935).
// src/app/(public)/scan/[domain]/_address/rescan.tsx
//
// **What was wrong.** `report-view.tsx` drew *Measure what's missing* and
// its sibling *Measure again* / *Try again* as `<button type="button">`
// with no handler: drawn, focusable, tabbable, and doing nothing. SPEC
// §1's line of 2026-09-20 names those two by name — "the report's *Try
// again*, *Measure what's missing* and its one notice control act or are
// not drawn" — and #935 restates it as the whole issue's done-when ("tab
// through the report: every focusable control does something").
//
// **It is a form first.** The control posts the domain to `/api/scan`,
// which is the same door the landing field goes through and answers a form
// post with `303` to the address. So it works with no JavaScript at all,
// and nothing starts by itself: the measurement begins when the visitor
// presses it and not before. `view.tsx`'s cooldown arm has been exactly
// this since #936; this is that arm's shape, on the screen that still
// lacked it.
//
// **With JavaScript it follows the pass instead of leaving the reader on a
// stale report.** A stored report outranks a running scan in `resolve.ts`
// (its row 3 before its row 4), which is right — the report is a thing to
// read and the new pass has nothing to show yet — but it means a plain
// redirect lands the reader back on the same page with no sign their press
// did anything. So the submit handler asks the same route in JSON, takes
// the scan id back, and hands it to `ScanProgress`: the named stages, and
// then the refresh `ScanProgress` itself asks for, which swaps the new
// report in. That is the
// pattern `correction.tsx` beside this file already uses for the other
// re-measurement this screen can start, and the two now read alike.
//
// **A refusal is not a failure.** Admission can turn the start down — five
// an hour, one in flight, the day's bounds — and answers `{ ok: true,
// location }` with no scan id. There is nothing to follow, so the browser
// goes to that location, which is the same document the form post would
// have landed on: the refusal arrives as the notice the report screen
// already renders, written, in its own words.
//
// daisyUI in the route (DESIGN rule 1): `btn btn-outline`. The screen's one
// solid button is the offer's Start, so this one is outline.
"use client";

import { useState, type FormEvent } from "react";
import { copy } from "@/lib/presentation/copy";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StartScanResponse } from "@/app/api/scan/route";
import { ScanProgress } from "./progress";

/** The route's own field and handle, spelled here once. A start that does
 *  not carry it is an ordinary start, which is what every other press on
 *  this control means. */
const RESCAN_FIELD = "rescan";
const RESCAN_INCOMPLETE = "incomplete";

type Step = { kind: "idle" } | { kind: "sending" } | { kind: "running"; scanId: string };

/** What a start came back with: the pass to follow, or the address to go
 *  back to. A refusal is the second of those and not an error — the route
 *  answers `{ ok: true, location }` with no scan id, and the address it
 *  names says in writing what happened. A network failure, or a body that
 *  is not the route's own shape, is the same answer with no location: go
 *  back to where we are, and let the server say. */
type Started = { follow: string } | { reread: string | null };

async function start(domain: CanonicalDomain, incomplete: boolean): Promise<Started> {
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value: domain,
        ...(incomplete ? { [RESCAN_FIELD]: RESCAN_INCOMPLETE } : {}),
      }),
    });
    const body = (await response.json()) as StartScanResponse;
    if (!body.ok) return { reread: null };
    return body.scanId === undefined ? { reread: body.location } : { follow: body.scanId };
  } catch {
    return { reread: null };
  }
}

export function RescanControl(p: {
  domain: CanonicalDomain;
  /** Already written by the caller, which owns the choice of word: the
   *  notice's control and a standalone one must not name the same action
   *  two different ways (`report-view.tsx`'s `controlLabel`). */
  label: string;
  /** Whether this press is the answer to an incomplete report, which is
   *  the one reason the route is told about — see `route.ts`'s `Rescan`. */
  incomplete: boolean;
  testId: string;
}): React.JSX.Element {
  const [step, setStep] = useState<Step>({ kind: "idle" });

  if (step.kind === "running") {
    return (
      <div className="flex min-w-0 basis-full flex-col gap-2 text-sm" data-testid={`${p.testId}-running`}>
        <p>{copy("scan.rescanning.line")}</p>
        <ScanProgress domain={p.domain} scanId={step.scanId} />
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    // Only once the handler is running is the form's own post redundant;
    // without JavaScript this never fires and the post is the whole
    // control.
    event.preventDefault();
    setStep({ kind: "sending" });
    const started = await start(p.domain, p.incomplete);
    if ("follow" in started) {
      setStep({ kind: "running", scanId: started.follow });
      return;
    }
    // Nothing to follow. The address knows why, so read it again — the
    // same document the form post would have landed on. A navigation and
    // not `router.refresh()`: this component is rendered by the report
    // screen on the server, and a router hook at its top would make every
    // static render of that screen require a mounted router.
    setStep({ kind: "idle" });
    window.location.assign(started.reread ?? window.location.href);
  }

  return (
    <form action="/api/scan" method="post" onSubmit={onSubmit}>
      <input type="hidden" name="value" value={p.domain} />
      {p.incomplete ? <input type="hidden" name={RESCAN_FIELD} value={RESCAN_INCOMPLETE} /> : null}
      <button type="submit" className="btn btn-outline btn-sm" disabled={step.kind === "sending"} data-testid={p.testId}>
        {p.label}
      </button>
    </form>
  );
}
