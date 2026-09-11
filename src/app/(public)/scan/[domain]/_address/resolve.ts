// BUILD §4.1 — what one visit to /scan/{domain} resolves to, from the store
//
// The eight-row first-match order that turns a written domain into exactly
// one arm of `AddressState`. #13 declared the union and rendered it from
// fixtures; #100 landed the pipeline and `readCurrentReport`. This is the
// join: it composes `parseDomain`, `admitFreeScan` and `readCurrentReport`
// and holds no SQL, no vendor call and no measurement of its own
// (`ARCHITECTURE.md` rule 1 — an adapter over the engine's own interfaces,
// which is what DECISIONS 2026-09-05/#83 permits under `src/app/`).
//
// **The order is the promise, and reordering it changes what a visitor is
// shown.** First match wins:
//
//   1. the segment does not parse            → `malformed`
//   2. the domain's report was removed        → `removed`
//   3. a current report exists                → `report` (+ one notice, one control)
//   4. a scan for *this* domain is running    → `scanning`
//   5. a scan here failed inside the cooldown → `cooldown`
//   6. admission refuses for any other reason → `refused`
//   7. otherwise                              → `starting`
//
// Row 2 outranks every row below it and that is the whole of REQ-002 c3: a
// report withdrawn on the site owner's written request is shown to nobody,
// including the visitor whose scan would otherwise have started one. Row 3
// outranks rows 4–6 because a stored report is a thing to read: a refusal
// or a cooldown then travels as a *notice beside the report* (the arms
// `AddressNotice` carries), never as a screen that hides what was already
// measured.
//
// **Nothing here starts a scan.** Row 7 hands the visitor the `starting`
// arm and `ScanProgress` posts `/api/scan` from the browser on first
// frame — REQ-001 c9's "never during server render", which is what keeps
// a crawler, a prefetch or a refresh from spending money.
import { FREE_RESCAN_WINDOW_D } from "@/lib/config/constants";
import { admitFreeScan, type Admission, type NetworkKey } from "@/lib/scan/admission";
import { isDomainRemoved } from "@/lib/scan/removal";
import { RUNNING_ROW_BOUND_S } from "@/lib/scan/stuck";
import { parseDomain, type CanonicalDomain } from "@/lib/scan/domain";
import { readCurrentReport, type StoredReport } from "@/lib/scan/report";
import { correctionOffer } from "@/lib/market/coherence/offer";
import type { AddressControl, AddressNotice, AddressRefusal, AddressState } from "./state";
import { categoryOf } from "@/lib/scan/sections";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** The refusing half of `Admission`, mapped to the sentence the visitor is
 *  shown. `in_flight` for *another* domain is "a scan is already running
 *  from your network"; the hourly and daily counters are both "that is n
 *  scans from your network"; ReachKit's own stop is neither, and says so
 *  in its own line (ADR-011: our own stop outranks every other cause that
 *  is also true, and is never dressed as one). `removed` and `cooldown`
 *  never reach here — they are rows 2 and 5, with screens of their own. */
function refusalOf(admission: Exclude<Admission, { admit: true }>, now: Date): AddressRefusal | null {
  switch (admission.refuse) {
    case "hourly":
    case "daily":
      return { reason: "network-limit", retryAfterSeconds: admission.retryAfterSeconds };
    case "in_flight":
      return { reason: "scan-running", retryAfterSeconds: inFlightWaitSeconds(admission.runningSince, now) };
    case "switched_off":
      return { reason: "stopped" };
    case "removed":
      // Admission fails **closed** on the removal read: a read it cannot
      // answer refuses the scan, because spending on a domain that might
      // be removed is the worse mistake. That is right for its decision
      // and wrong for this one — row 2 above has already asked the
      // question directly, so reaching here means the table said no or
      // could not be reached. Either way no scan will run and the visitor
      // did not cause it, which is our own stop, not a removal.
      return { reason: "stopped" };
    case "cooldown":
      return null;
  }
}

/** How long until the network holding a scan in flight is certainly free
 *  (issue #510). Not the pass's own ceiling: a pass the platform froze
 *  leaves its row `running` until the sweep clears it, and the sweep keys
 *  on `RUNNING_ROW_BOUND_S` (platform ceiling + sweep margin) from the
 *  row's `created_at`. A wait shorter than that would send the visitor
 *  back to be refused again. So the wait is the time left until that
 *  bound, floored at 0 — past it the row is the sweep's, not the visitor's
 *  to wait on. A refusal whose running row could not be re-read carries no
 *  clock, and the whole bound is the only figure that is still an upper
 *  bound. Whole seconds, rounded up, like admission's own waits. */
function inFlightWaitSeconds(runningSince: Date | undefined, now: Date): number {
  if (runningSince === undefined) return RUNNING_ROW_BOUND_S;
  const clearsAtMs = runningSince.getTime() + RUNNING_ROW_BOUND_S * 1000;
  return Math.max(0, Math.ceil((clearsAtMs - now.getTime()) / 1000));
}

/** REQ-001 c16: exactly one control that starts a new measurement, or
 *  none — never a second one beside it. The order is the precedence:
 *
 *   1. a correction that ran and produced no report offers its one retry
 *      (REQ-094 c7) — the most specific thing that just happened;
 *   2. a report the ceilings cut short offers "measure what's missing"
 *      (REQ-001 c14), and that offer is made once and does not chain, so a
 *      report that is itself the product of such a re-scan offers nothing;
 *   3. a report old enough that a re-scan is the visitor's route offers
 *      "measure again" (REQ-001 c15);
 *   4. otherwise none.
 *
 *  A refusal in force suppresses every control: offering a button that
 *  cannot spend is worse than offering none. */
function controlFor(a: {
  report: StoredReport;
  correctionRetryOffered: boolean;
  refused: boolean;
  now: Date;
}): AddressControl {
  if (a.refused) return { kind: "none" };
  if (a.correctionRetryOffered) return { kind: "correction_retry" };
  if (!a.report.complete) {
    return a.report.fromIncompleteRescan ? { kind: "none" } : { kind: "rescan", because: "incomplete" };
  }
  if (wholeDaysBetween(a.report.verdict.measuredAt, a.now) >= FREE_RESCAN_WINDOW_D) {
    return { kind: "rescan", because: "age" };
  }
  return { kind: "none" };
}

/** At most one line beside the report, in the order the most specific true
 *  thing comes first. A refusal in force is what just happened to *this*
 *  visitor and outranks the report's own history. */
function noticeFor(a: {
  report: StoredReport;
  refusal: AddressRefusal | null;
  correctionFailed: boolean;
}): AddressNotice | null {
  if (a.refusal !== null) return { kind: "refused", refusal: a.refusal };
  if (a.correctionFailed) return { kind: "correction_failed" };
  if (a.report.stoppedReason === "site_unreadable") return { kind: "site_unreadable" };
  if (!a.report.complete) {
    return { kind: "incomplete", unmeasured: a.report.verdict.missing.map((m) => m.factor) };
  }
  return null;
}

/** A correction that ran and produced no report leaves its subject current
 *  and its state on `failed_once`; `exhausted` means both attempts are
 *  gone. Read from the report the visitor is about to be shown, never from
 *  a second query about a different one. */
function correctionStateOf(report: StoredReport): { failed: boolean; retryOffered: boolean } {
  const state = report.correctionState;
  if (state === "failed_once") return { failed: true, retryOffered: true };
  if (state === "exhausted") return { failed: true, retryOffered: false };
  return { failed: false, retryOffered: false };
}

/**
 * The one resolution. Takes the segment as written and the visitor's
 * network key, and answers with exactly one arm.
 *
 * `admitFreeScan` is asked **before** the stored report is read only in
 * the sense that both are needed: the read decides row 3 and the admission
 * decides rows 2 and 4–6, and neither consumes an allowance — admission
 * checks, `claimFreeScanSlot` consumes, and nothing here calls that.
 */
export async function resolveAddress(a: {
  rawSegment: string;
  network: NetworkKey;
  now?: Date;
}): Promise<AddressState> {
  const now = a.now ?? new Date();

  // 1. Malformed.
  const parsed = parseDomain(a.rawSegment);
  if (!parsed.ok) return { kind: "malformed", problem: parsed.problem, value: a.rawSegment };
  const domain: CanonicalDomain = parsed.domain;

  // 2. Removed — outranks everything below, including a stored report.
  //
  // Asked of the removal table directly, and **not** read off admission's
  // `removed` refusal. Admission fails closed on that read, so a database
  // it cannot reach refuses the scan — which is right for spending money
  // and wrong here: this arm renders REQ-002 c3's sentence, which asserts
  // that a written removal request was received. An outage must not tell
  // every visitor their report was taken down at their own request. A read
  // that cannot be answered is therefore *not* a removal — the same
  // fail-open the 410 rewrite uses, so the two cannot disagree about which
  // domains are removed.
  if (await removedForCertain(domain)) return { kind: "removed", domain };

  const admission = await admitFreeScan({ domain, network: a.network });
  const refusal = "admit" in admission ? null : refusalOf(admission, now);

  // 3. A current report is a thing to read; a refusal or a cooldown beside
  //    it is a notice, never a screen that hides it.
  //
  // A read that cannot be answered is not "no report": we do not know
  // whether one exists, and the two arms below that would follow from
  // guessing are both wrong — `starting` would spend money on a domain
  // that may already have a report, and rendering nothing would answer a
  // report address with an unhandled error, which REQ-001 c5 forbids
  // absolutely. What is true is that we cannot serve a report and the
  // visitor did not cause it, which is our own stop.
  let report: StoredReport | null;
  try {
    report = await readCurrentReport(domain);
  } catch {
    return { kind: "refused", domain, refusal: { reason: "stopped" } };
  }
  if (report !== null) {
    const correction = correctionStateOf(report);
    return {
      kind: "report",
      report,
      notice: noticeFor({ report, refusal, correctionFailed: correction.failed }),
      control: controlFor({
        report,
        correctionRetryOffered: correction.retryOffered && correctionOfferStands(report, now),
        refused: refusal !== null,
        now,
      }),
    };
  }

  // 4. A scan for *this* domain is already running: join it rather than
  //    starting a second (REQ-003 c7).
  if (!("admit" in admission) && admission.refuse === "in_flight" && admission.sameDomain) {
    const scanId = admission.runningScanId;
    if (scanId !== undefined) return { kind: "scanning", domain, scanId };
    return { kind: "starting", domain };
  }

  // 5. A scan here failed inside the cooldown window: one line, one manual
  //    retry, nothing automatic (REQ-001 c16).
  if (!("admit" in admission) && admission.refuse === "cooldown") {
    return { kind: "cooldown", domain };
  }

  // 6. Any other refusal, with no stored report to put it beside.
  if (refusal !== null) return { kind: "refused", domain, refusal };

  // 7. Nothing here yet, and nothing in the way.
  return { kind: "starting", domain };
}

/** Whether this domain's report was withdrawn on a written request, as a
 *  fact and not as an inference. A read that cannot be answered is
 *  `false`: the report renders, which is the wrong answer for a removed
 *  domain and the only one that does not take every live report down with
 *  the database. The rewrite applies the same rule to the same read before
 *  this runs; this is the second half of it, for a render that reaches the
 *  page another way. */
async function removedForCertain(domain: CanonicalDomain): Promise<boolean> {
  try {
    return await isDomainRemoved(domain);
  } catch {
    return false;
  }
}

/** The correction's own age bound, asked of the report the visitor is
 *  looking at. `readCorrectionFacts` is not called: every field the offer
 *  reads is already on the blob, and a second read could answer about a
 *  different report than the one being rendered. */
function correctionOfferStands(report: StoredReport, now: Date): boolean {
  const offer = correctionOffer({
    report: {
      scanId: report.scanId,
      measuredAt: report.verdict.measuredAt,
      category: categoryOf(report.market),
      correctionState: report.correctionState,
      // Row 2 already returned for a removed domain, so by here it is not.
      domainRemoved: false,
    },
    now,
  });
  return offer.offered;
}
