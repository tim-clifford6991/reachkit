// BUILD §4.1 — what one visit to /scan/{domain} resolves to
//
// The closed union the address renders exactly one arm of, plus the two
// smaller unions a `report` arm carries. Types only: this file decides
// nothing and reads nothing. Who *resolves* a visit to an arm is issue
// #25's (`readCurrentReport`, the pipeline) and #28's (removal); what a
// resolved arm looks like on screen is `view.tsx`'s.
//
// Totality is the whole point. `view.tsx` switches over `kind` with a
// `never` default, so a seventh arm added here fails the build until it
// has a rendering — which is what makes "never a blank page, a 404 or an
// unhandled error" a property rather than a review note.
import type { DomainProblem, CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";
import type { ScoreFactorName } from "@/lib/measure/score";

/** The four refusals a visitor can be shown in writing. Named by the
 *  sentence each renders, not by the admission internals behind them:
 *  `src/lib/scan/admission.ts`'s `Admission` union is the engine's own
 *  vocabulary, and its `cooldown` and `removed` arms are separate
 *  `AddressState` arms here rather than refusals, because they carry a
 *  different screen. */
export type AddressRefusal =
  | { reason: "network-limit"; retryAfterSeconds: number }
  | { reason: "scan-running"; retryAfterSeconds: number }
  /** ReachKit's own stop — the kill switch, not anything the visitor did.
   *  It carries no wait: nobody can say when we will start again, and a
   *  figure invented to fill the sentence would be the one part of a
   *  refusal that was not true. ADR-011: our own stop outranks every other
   *  cause that is also true, and is never dressed as one of them. */
  | { reason: "stopped" };

/** The drivers an `incomplete` notice names, **and at least one of them**.
 *
 *  REQ-001 c14's line "names what was not measured", and REQ-004 c3 makes
 *  the naming the point of it. A notice with nothing to name is therefore
 *  not a notice: its `{what}` slot renders the empty string and the
 *  sentence comes out as "This report is incomplete — wasn’t measured.",
 *  which is what production served on 2026-09-11 (issue #541). It says the
 *  report is incomplete and gives the visitor no idea which part, at the
 *  top of the only artefact the free funnel produces.
 *
 *  The empty case is removed from the type rather than guarded at the call
 *  site, so the ungrammatical render is *unrepresentable* rather than
 *  merely unreached: `report-view.tsx` fills the slot from this list and
 *  has no branch in which it could be empty. Narrowing to it is
 *  `resolve.ts`'s one job (`unmeasuredFactorsOf`), and a report with no
 *  factor to name carries no `incomplete` notice at all. */
export type UnmeasuredFactors = readonly [ScoreFactorName, ...ScoreFactorName[]];

/** At most one line ever renders (REQ-001 c14/c16, REQ-003 c12). `null`
 *  is an arm of the switch, not a missing value. */
export type AddressNotice =
  | { kind: "incomplete"; unmeasured: UnmeasuredFactors }
  /** The pass could not read the site's own home document and stopped
   *  there (`stoppedReason: "site_unreadable"`, #479). Outranks
   *  `incomplete`: every factor is missing, and the one true cause is the
   *  line, not a list of the factors it took with it. */
  | { kind: "site_unreadable" }
  | { kind: "measurement_failed"; failedAt: Date }
  | { kind: "correction_failed" }
  | { kind: "refused"; refusal: AddressRefusal };

/** Exactly one control that starts a new measurement, or none — never a
 *  second one alongside it (REQ-001 c16). The copy-link control is not a
 *  member: it starts no measurement and coexists with every arm. */
export type AddressControl =
  | { kind: "none" }
  | { kind: "rescan"; because: "incomplete" | "age" }
  | { kind: "retry" }
  | { kind: "correction_retry" };

export type AddressState =
  /** REQ-001 c4: one written line names what is wrong, and the landing
   *  field is offered. The five lines are the landing page's own. */
  | { kind: "malformed"; problem: DomainProblem; value: string }
  /** REQ-002 c3 / REQ-001 c18: one line, the removal address, and no
   *  route back — no re-scan, no retry, no form. The status is `410 Gone`
   *  (owner ruling 2026-09-05, #28; `REPORT_REMOVED_STATUS`), which a
   *  Next `page.tsx` cannot set — see `view.tsx`'s own note on this arm. */
  | { kind: "removed"; domain: CanonicalDomain }
  /** REQ-001 c9: no scan is running yet and the visitor need do nothing —
   *  the client posts `/api/scan` on first frame, never during server
   *  render. */
  | { kind: "starting"; domain: CanonicalDomain }
  /** REQ-003 c1/c3: named stages that advance, and the report swaps in on
   *  the stream's ending event without a reload. */
  | { kind: "scanning"; domain: CanonicalDomain; scanId: string }
  /** REQ-003 c12, with no stored report to show: the refusal in writing,
   *  and no scan starts. */
  | { kind: "refused"; domain: CanonicalDomain; refusal: AddressRefusal }
  /** REQ-001 c16: a scan failed without producing a report less than 24
   *  hours ago — one line, one manual retry, nothing automatic. */
  | { kind: "cooldown"; domain: CanonicalDomain }
  | {
      kind: "report";
      report: StoredReport;
      notice: AddressNotice | null;
      control: AddressControl;
    };
