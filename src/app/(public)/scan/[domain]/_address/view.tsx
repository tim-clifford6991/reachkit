// BUILD §4.1 — the total switch over what a visit resolved to
//
// Exactly one arm renders. The `switch` is total over `AddressState.kind`
// with a `never` default, so an eighth arm added to `state.ts` fails the
// build until it has a rendering here — which is what makes "never a blank
// page, a 404 or an unhandled error" a property of the type rather than a
// promise in prose.
//
// Every line on every arm is a `CopyKey`. The `malformed` arm reuses the
// landing page's own five `landing.problem.*` lines rather than minting
// five more: same union, same wording obligation, one home per claim.
import type React from "react";
import Link from "next/link";
import { Clock, RefreshCw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { QuietPage } from "@/app/_quiet/QuietCard";
import LandingPage from "@/app/(public)/page";
import { ReportView } from "./report-view";
import { RemovedView } from "./removal";
import { ScanningView } from "./scanning";
import type { AddressState } from "./state";
import { refusalHeading, refusalLine } from "./refusal";
import { Num } from "./measured";

/* `StateCard` and `Pane` stood here for the two scanning arms and were
   the last readers of either: #936 moved the short arms onto `QuietPage`
   and #935 moved the scanning arms onto `ScanningView`, which draws the
   report's own sections beside the stages and declares its own band arms.
   Neither shape is wanted again — a new arm takes `QuietPage`. */

/** The report a refused visitor is offered instead: the dev fixture's own
 *  address, which is the one report that exists whatever the database
 *  holds and the one the owner reviews. */
const EXAMPLE_REPORT = "/scan/example.com";

export function AddressView(p: {
  state: AddressState;
  /** Issue #785: the report's checkout came back refused. Read by the
   *  report arm's offer only. */
  checkoutRefused?: boolean;
}): React.JSX.Element {
  const state = p.state;
  switch (state.kind) {
    // REQ-001 c4: one written line names what is wrong, and the landing
    // field is offered — never a blank page, an unhandled error, or a scan.
    case "malformed":
      // The landing page's own component, not a second form: it already
      // renders the one field, the one submit and the one written line
      // per `DomainProblem`, and it carries both the JavaScript and the
      // no-JavaScript transport. Rendering it here is what "offered the
      // landing field" means, with no second copy of it to keep in step.
      // Rendered bare, for the same reason the `removed` arm below is:
      // the landing page has been a screen root with its own `Surface`
      // since #65, and wrapping it would make two on one document.
      return <LandingPage searchParams={{ problem: state.problem, value: state.value }} />;

    // REQ-002 c3 / REQ-001 c18: one line, the same address, and no route
    // back — no control, no form, no link anywhere in this arm. Rendered
    // bare: `RemovedView` (#28) is already a screen root with its own
    // `Surface`, and wrapping it would make two.
    //
    // **The status is not this file's to set, and is not yet set.** The
    // owner ruled on 2026-09-05 (#28) that a removed address serves `410
    // Gone`, pinned as `REPORT_REMOVED_STATUS` and carried with its
    // headers by that module's `REMOVED_RESPONSE_INIT`. A Next `page.tsx`
    // cannot return 410 — the framework offers `notFound`/`forbidden`/
    // `unauthorized` and no `gone` — so this arm currently serves the
    // right body with the wrong status. Flagged in this PR rather than
    // worked around with a 404, which would be a different, wrong promise
    // (REQ-001 c5 forbids answering a report address with one).
    case "removed":
      return <RemovedView domain={state.domain} />;

    // REQ-001 c9: a scan is already underway with no further action from
    // the visitor. The client posts /api/scan on first frame; nothing is
    // posted during server render.
    //
    // **The report's sections stand beside the stages from the first
    // frame** (SPEC §2, 2026-09-20 — "no full-page wait"). Both arms are
    // `ScanningView`, which declares its own band arms and is therefore
    // rendered bare, for the same reason the `removed` and `malformed`
    // arms are: two `Surface`s on one document is one too many.
    case "starting":
      return <ScanningView domain={state.domain} />;
    case "scanning":
      return <ScanningView domain={state.domain} scanId={state.scanId} />;

    // REQ-003 c12: the refusal in writing, and no scan starts.
    //
    // **It used to offer no control at all** — a bare alert, and a
    // stranger's first meeting with the product ending with nothing to
    // press. SPEC §1 (2026-09-20) settles it the other way: "the removed
    // and refused arms offer a way back to the landing". So this is the
    // quiet card, with the wait in the heading (it is the answer to the
    // only question the reader has) and the approved refusal sentence
    // beneath it, unchanged.
    //
    // Neither control starts a scan, which is what REQ-003 c12 forbids:
    // one reads a report that already exists, the other goes back to the
    // field. Both are links.
    case "refused":
      return (
        <QuietPage
          icon={Clock}
          tone="warn"
          testId="scan-refused"
          eyebrow={<Num>{state.domain}</Num>}
          heading={refusalHeading(state.refusal)}
          lines={[refusalLine(state.refusal)]}
          actions={
            <>
              <Link href={EXAMPLE_REPORT} className="btn btn-soft btn-primary btn-sm">
                {copy("control.example-report")}
              </Link>
              <Link href="/" className="btn btn-ghost btn-sm">
                {copy("control.back-to-start")}
              </Link>
            </>
          }
        />
      );

    // REQ-001 c16: one line says what happened, one manual retry is
    // offered, and no scan starts by itself.
    //
    // **The retry now retries** (#936). It was a `<button type="button">`
    // with no handler — drawn, focusable, and doing nothing, which is the
    // defect SPEC §1's 2026-09-20 line names ("every control on them does
    // something"). It is a form posting the domain to the scan API, which
    // is the same door the landing field goes through and answers a form
    // post with `303` to the address (`api/scan/route.ts`). So it works
    // with no JavaScript at all, and nothing starts by itself: the scan
    // begins when the visitor presses it and not before.
    case "cooldown":
      return (
        <QuietPage
          icon={RefreshCw}
          tone="warn"
          testId="scan-cooldown"
          eyebrow={<Num>{state.domain}</Num>}
          heading={copy("quiet.cooldown.head")}
          lines={[copy("notice.measurement-failed")]}
          actions={
            <form action="/api/scan" method="post">
              <input type="hidden" name="value" value={state.domain} />
              <button type="submit" className="btn btn-primary btn-sm" data-testid="scan-cooldown-retry">
                {copy("control.retry")}
              </button>
            </form>
          }
        />
      );

    case "report":
      return <ReportView state={state} checkoutRefused={p.checkoutRefused} />;

    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
