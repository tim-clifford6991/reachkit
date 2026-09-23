// src/app/api/report/{domain}/retry/route.ts — SPEC §2, issue 715 — the
// transport adapter over "Retry this part".
//
// A thin adapter and nothing more, on exactly the footing the correction
// route beside it stands on: it parses the address segment and one body
// field, asks `retry.ts` whether that part may be re-run, and — only where
// it may — starts one re-measurement inside the report's own budget. It
// holds no ceiling, no allowance arithmetic and no SQL of its own, and it
// decides nothing about availability.
//
// **Nothing is spent by a refusal this route makes.** Every arm below
// returns before the runner is reached, and the runner is the only thing
// here that can claim a row or buy anything.
//
// **This route never calls `admitFreeScan` or `claimFreeScanSlot`.** A
// retry re-measures inside the scan it retries: it spends no further scan
// allowance and opens no second spend ceiling (the retried row's
// `cost_cents` becomes the new pass's `priorCents`, so the 12¢ free cap
// covers both), and there is no call here through which it could.
//
// It returns handles, never sentences: every key below is turned into a
// written line by the copy registry, on the surface that renders it. It is
// wrapped in `adapter()` (BUILD §11's convention as code), so it emits the
// one request line every API route emits and a thrown error — a database
// failure reading the report, a vendor payload from inside the
// re-measurement — answers `unavailable` rather than reaching a body.
import { after } from "next/server";
import { adapter } from "../../../_adapter";
import { env } from "@/lib/config/env";
import { parseDomain, type DomainProblem } from "@/lib/scan/domain";
import {
  isRetryPart,
  readRetryFacts,
  retryOffer,
  retryRunner,
  type RetryPart,
  type RetryRefusal,
} from "@/lib/scan/retry";
// Side-effect import: the scan pipeline registers itself as the retry
// runner at its own module load (`registerRetryRunner`). Route modules are
// separate entry points, so without this line nothing is registered in
// this one's graph and every retry would refuse with `scanning_unavailable`
// — a refusal that would be untrue.
import "@/lib/scan/run";

export type RetryPartResponse =
  | { ok: true; scanId: string }
  | { ok: false; problem: DomainProblem }
  | { ok: false; refused: RetryRefusal };

/** One status per refusal, so a caller that reads neither the body nor the
 *  registry still gets the right shape of answer. `not_cut_off` and
 *  `part_present` are 409s: the report is fine, the request is against a
 *  state it is not in. */
const REFUSAL_STATUS: Readonly<Record<RetryRefusal, number>> = {
  no_current_report: 404,
  not_cut_off: 409,
  part_present: 409,
  no_budget_left: 409,
  domain_removed: 410,
  scanning_unavailable: 503,
};

function refuse(refused: RetryRefusal): Response {
  log({ outcome: "refused", refused });
  return Response.json({ ok: false, refused } satisfies RetryPartResponse, {
    status: REFUSAL_STATUS[refused],
  });
}

/** One body field, the part. A value outside `RetryPart` is malformed and
 *  not a refusal: there is no report state it could be true of, so it gets
 *  no sentence and no offer decision. */
async function readPart(request: Request): Promise<RetryPart | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("part" in parsed)) return null;
  const part = (parsed as { part: unknown }).part;
  return isRetryPart(part) ? part : null;
}

const ROUTE_ID = "POST /api/report/{domain}/retry";

async function handle(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
): Promise<Response> {
  const { domain: segment } = await params;

  const parsed = parseDomain(segment);
  if (!parsed.ok) {
    log({ outcome: "malformed_domain" });
    return Response.json({ ok: false, problem: parsed.problem } satisfies RetryPartResponse, { status: 422 });
  }

  const part = await readPart(request);
  if (part === null) {
    log({ outcome: "malformed_body" });
    return Response.json({ error: "malformed request body" }, { status: 400 });
  }

  // The offer first, from the row's own facts: a report that was not cut
  // off by a ceiling, a part that is already on it, a removed domain and a
  // report whose pass has spent the whole 12¢ are all turned down here,
  // before anything can claim a row.
  const facts = await readRetryFacts(parsed.domain);
  const offer = retryOffer({ facts, part });
  if (!offer.offered) return refuse(offer.because);

  // Free scanning switched off, or no pipeline to run the re-measurement:
  // refused before it ran, so nothing was claimed and the control still
  // stands.
  const runner = retryRunner();
  if (env.KILL_SWITCH || runner === null || facts === null) return refuse("scanning_unavailable");

  // The seam answers once the retry's row exists and the pass has started,
  // so the report can follow its stages at once; the pass itself is handed
  // to `after()`, which keeps this invocation alive until it settles,
  // exactly as `POST /api/scan` and the correction route do.
  const run = await runner({ domain: parsed.domain, tier: "free", retryOf: facts.scanId, part });
  after(async () => {
    try {
      const { status } = await run.finished;
      log({ outcome: "finished", scanId: run.scanId, part, status });
    } catch (error: unknown) {
      log({
        outcome: "run_failed",
        scanId: run.scanId,
        part,
        because: error instanceof Error ? error.message : String(error),
      });
    }
  });
  log({ outcome: "accepted", scanId: run.scanId, retryOf: facts.scanId, part });
  return Response.json({ ok: true, scanId: run.scanId } satisfies RetryPartResponse, { status: 200 });
}

export const POST = adapter(ROUTE_ID, handle);

/** The platform's bound on this invocation, which carries the retry past
 *  the response. The same literal `POST /api/scan` declares, for the same
 *  reason: Next reads it out of the source at build time. */
export const maxDuration = 60;

/** What became of the retry — a different fact from the request line
 *  `adapter()` emits, which says only that a request was answered. The scan
 *  ids, the part and the outcome; never a payload. */
function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "report_retry_part", ...fields }));
}
