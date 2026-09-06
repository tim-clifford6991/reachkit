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
import { Alert, Btn } from "@/ui/components";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import LandingPage from "@/app/(public)/page";
import { ReportView } from "./report-view";
import { RemovedView } from "./removal";
import { ScanProgress } from "./progress";
import type { AddressState } from "./state";
import { refusalLine } from "./refusal";

/** The frame every short arm renders inside, and its screen root
 *  (ADR-093 decision 6: every screen root is a `Surface`, and its three
 *  arms are declared, never defaulted). One column at every band: each of
 *  these arms is one written line and at most one control, which is one
 *  column at any width. The `report` arm is the long screen and declares
 *  its own arms; the `removed` arm brings its own `Surface` from
 *  `_address/removal.tsx`. */
function Pane(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex max-w-[640px] flex-col gap-4 p-6">
        {p.children}
      </main>
    </Surface>
  );
}

export function AddressView(p: {
  state: AddressState;
  /** The canonical address of this report — REQ-001 c7's copy-link value,
   *  built by the route and never composed inside a view. */
  canonicalUrl: string;
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
    case "starting":
      return (
        <Pane>
          <ScanProgress domain={state.domain} />
        </Pane>
      );
    case "scanning":
      return (
        <Pane>
          <ScanProgress domain={state.domain} scanId={state.scanId} />
        </Pane>
      );

    // REQ-003 c12: the refusal in writing, and no scan starts. This arm
    // offers no control at all.
    case "refused":
      return (
        <Pane>
          <Alert tone="neutral" message={refusalLine(state.refusal)} />
        </Pane>
      );

    // REQ-001 c16: one line says what happened, one manual retry is
    // offered, and no scan starts by itself.
    case "cooldown":
      return (
        <Pane>
          <Alert tone="warn" message={copy("notice.measurement-failed")} />
          <Btn label={copy("control.retry")} />
        </Pane>
      );

    case "report":
      return <ReportView state={state} canonicalUrl={p.canonicalUrl} />;

    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
