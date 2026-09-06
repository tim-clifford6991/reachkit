// src/app/api/report/[domain]/correct/route.ts — BUILD §6.7 — the transport adapter over
// the one market correction (§6.7 step 5).
//
// A thin adapter and nothing more: it parses the address segment and one
// body field, asks the market module whether a correction is on offer,
// asks the state machine what a submission does to the stored state, and —
// only where that advances — starts one re-measurement inside the scan it
// corrects. It holds no state table, no threshold, no allowance arithmetic
// and no SQL of its own, and it decides nothing about availability.
//
// **Nothing is spent by a refusal this route makes.** Where the offer is
// closed, the state machine is never asked to advance anything; where the
// run cannot start at all — the kill switch, or no pipeline registered —
// the machine is asked with `refused_before_run`, which returns the
// current state unchanged, and neither of the reader's two attempts is
// used. The two refusal vocabularies are kept apart on the wire as they
// are in the machine: a correction already under way answers
// `already_running`, one already spent answers `already_used`, and the two
// are never collapsed into one key.
//
// **The re-measurement is issue #25's `runScan`**, reached through the seam
// `@/lib/scan/correction` declares. This route never calls
// `admitFreeScan` or `claimFreeScanSlot`: a correction re-measures inside
// the scan it corrects, spends no further scan allowance and opens no
// second spend ceiling, and there is no call here through which it could.
//
// This route returns handles, never sentences: every key below is turned
// into a written line by the copy registry, on the surface that renders it.
// It is wrapped in `adapter()` (BUILD §11's convention as code), so it
// emits the one request line every API route emits and a thrown error —
// a database failure reading the report, a vendor payload from inside the
// re-measurement — answers `unavailable` rather than reaching a body.
import { adapter } from "../../../_adapter";
import { env } from "@/lib/config/env";
import { correctionOffer } from "@/lib/market/coherence/offer";
import { nextCorrectionState } from "@/lib/market/coherence/state";
import { advanceCorrectionState, correctionRunner, readCorrectionFacts } from "@/lib/scan/correction";
// Side-effect import: the scan pipeline registers itself as the correction
// runner at its own module load (`registerCorrectionRunner`, issue #25).
// Route modules are separate entry points, so without this line nothing is
// registered in this one's graph and every correction would refuse with
// `scanning_unavailable` — a refusal that would be untrue.
import "@/lib/scan/run";
import { parseDomain, type DomainProblem } from "@/lib/scan/domain";

/** Every way a submission can be turned down, as one flat vocabulary.
 *  `used`/`exhausted` are the offer's terminal reasons and
 *  `already_used` is the machine's refusal of a submission against one of
 *  them: both say the attempts are gone, and both are kept because they
 *  are reached at different moments and REQ-094 c5 binds each outcome to
 *  its own written line. */
export type CorrectionRefusal =
  | "used"
  | "exhausted"
  | "in_progress"
  | "report_too_old"
  | "domain_removed"
  | "already_running"
  | "already_used"
  | "no_current_report"
  | "scanning_unavailable";

export type CorrectReportResponse =
  | { ok: true; scanId: string }
  | { ok: false; problem: DomainProblem }
  | { ok: false; refused: CorrectionRefusal };

const REFUSAL_STATUS: Readonly<Record<CorrectionRefusal, number>> = {
  used: 409,
  exhausted: 409,
  in_progress: 409,
  report_too_old: 409,
  domain_removed: 410,
  already_running: 409,
  already_used: 409,
  no_current_report: 404,
  scanning_unavailable: 503,
};

function refuse(refused: CorrectionRefusal): Response {
  log({ outcome: "refused", refused });
  return Response.json({ ok: false, refused } satisfies CorrectReportResponse, {
    status: REFUSAL_STATUS[refused],
  });
}

/** One body field, the corrected category, as an opaque string. It is
 *  neither checked against a vocabulary nor normalised here: no list of
 *  categories exists for this route to check against, and inventing one
 *  would be a second implementation of a check the market module owns. */
async function readCategory(request: Request): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("category" in parsed)) return null;
  const category = (parsed as { category: unknown }).category;
  return typeof category === "string" && category.trim().length > 0 ? category : null;
}

const ROUTE_ID = "POST /api/report/{domain}/correct";

async function handle(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
): Promise<Response> {
  const { domain: segment } = await params;

  const parsed = parseDomain(segment);
  if (!parsed.ok) {
    log({ outcome: "malformed_domain" });
    return Response.json({ ok: false, problem: parsed.problem } satisfies CorrectReportResponse, { status: 422 });
  }

  const category = await readCategory(request);
  if (category === null) {
    log({ outcome: "malformed_body" });
    return Response.json({ error: "malformed request body" }, { status: 400 });
  }

  const report = await readCorrectionFacts(parsed.domain);
  if (report === null) return refuse("no_current_report");

  // The offer first: where it is closed, the state machine is not asked at
  // all and nothing downstream is reached.
  const offer = correctionOffer({ report, now: new Date() });
  if (!offer.offered) return refuse(offer.because);

  const advanced = nextCorrectionState({ current: report.correctionState, event: "submitted" });
  if ("refused" in advanced) return refuse(advanced.refused);

  // Free scanning switched off, or no pipeline to run the re-measurement:
  // refused before it ran, so neither attempt is used and the control
  // still stands. The machine is asked with the event that says exactly
  // that, and its answer — the current state, unchanged — is what is left
  // stored.
  const runner = correctionRunner();
  if (env.KILL_SWITCH || runner === null) {
    nextCorrectionState({ current: report.correctionState, event: "refused_before_run" });
    return refuse("scanning_unavailable");
  }

  // Two submissions racing for one report resolve here, in Postgres: the
  // loser is told a correction is already under way, which is true.
  const won = await advanceCorrectionState({
    scanId: report.scanId,
    from: report.correctionState,
    to: advanced.next,
  });
  if (!won) return refuse("already_running");

  const run = await runner({ domain: parsed.domain, tier: "free", correctionOf: report.scanId });
  log({ outcome: "accepted", scanId: run.scanId, as: offer.as });
  return Response.json({ ok: true, scanId: run.scanId } satisfies CorrectReportResponse, { status: 200 });
}

export const POST = adapter(ROUTE_ID, handle);

/** What became of the correction — a different fact from the request line
 *  `adapter()` emits, which says only that a request was answered. The scan
 *  id and the outcome, never the submitted category and never a payload. */
function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "report_correction", ...fields }));
}
