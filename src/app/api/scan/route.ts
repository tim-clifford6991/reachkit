// src/app/api/scan/route.ts — BP-022 `## Public interface`, WO-062
//
// The canonicaliser and starter (BP-022 decision 3: "the API is a
// canonicaliser and a starter … the report is only ever served by `GET
// /scan/{domain}`"). A thin adapter (`structure.md` rule 1): it parses the
// body, calls WO-051's `parseDomain`, WO-057's `networkKeyOf` over
// `x-forwarded-for`, and WO-058's `claimFreeScanSlot`, and returns a
// location. It contains no admission logic, no SQL and no rendering.
//
// **Content negotiation** (WO-062 `## File plan`): a JSON request
// (`content-type: application/json`) gets `StartScanResponse` — 422 on a
// malformed domain, 200 otherwise. A form submission with no JavaScript
// (`application/x-www-form-urlencoded` or `multipart/form-data`) gets 303
// to the canonical address on success or refusal, and 303 back to the
// landing page carrying the problem handle and the submitted value on a
// malformed domain. Anything else — an unparseable body, or a body whose
// shape is not `{ value: string }` — is a 400 with no problem handle
// (`## Steps` step 2: "it is not a visitor's typed value").
//
// **A deviation flagged once here (constitution rule 4.2):** `##
// Interfaces` quotes `StartScanResponse` verbatim from BP-022 with
// `scanId: string` required on the `ok: true` arm. `## Steps` step 5 then
// overrides that reading explicitly — "respond with the canonical location
// and no scan id … Model this as `{ ok: true, location }` with `scanId`
// present only when a scan was claimed" — which is only representable if
// `scanId` is optional, not required. This file follows step 5's explicit
// instruction (`scanId?: string`) over the literal verbatim quote, since
// the quote and the step contradict each other and the step is the more
// specific, more recently reasoned instruction in the same document.
//
// **The landing page's query params, chosen here as a parameter
// (constitution rule 1.1 — an internal wire format between this adapter
// and WO-070's not-yet-built landing page, not a customer-visible string)
// and flagged once (rule 4.2) since WO-070 has not landed to confirm it
// reads them:** `problem` carries the `DomainProblem` handle and `value`
// carries the submitted text, verbatim, both as query params on `/`. Any
// value found here should be renamed together with WO-070's own reader,
// never redefined independently in that WO.
import { after } from "next/server";
import { parseDomain, type DomainProblem } from "@/lib/scan/domain";
import { networkKeyOf, claimFreeScanSlot } from "@/lib/scan/admission";

export type StartScanResponse =
  | { ok: true; location: string; scanId?: string } // REQ-001 c9; `## Steps` step 5
  | { ok: false; problem: DomainProblem }; // REQ-001 c3, HTTP 422

const LANDING_PATH = "/";

function canonicalLocation(domain: string): string {
  return `/scan/${domain}`;
}

type ParsedBody =
  | { transport: "json"; value: string }
  | { transport: "form"; value: string }
  | { transport: "malformed" };

/** `## Steps` step 2: "Parse and validate the request body to `{ value:
 *  string }`; anything else is a 400 with no problem handle, since it is
 *  not a visitor's typed value." Distinguishes the two transports by
 *  `content-type`; every other content type, and every body whose shape
 *  is not `{ value: string }` (JSON) or a `value` field (form), is
 *  `malformed`. */
async function readBody(request: Request): Promise<ParsedBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return { transport: "malformed" };
    }
    const value =
      typeof parsed === "object" && parsed !== null && "value" in parsed
        ? (parsed as { value: unknown }).value
        : undefined;
    if (typeof value !== "string") return { transport: "malformed" };
    return { transport: "json", value };
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { transport: "malformed" };
    }
    const value = form.get("value");
    if (typeof value !== "string") return { transport: "malformed" };
    return { transport: "form", value };
  }

  return { transport: "malformed" };
}

function landingRedirect(request: Request, problem: DomainProblem, value: string): Response {
  const url = new URL(LANDING_PATH, request.url);
  url.searchParams.set("problem", problem);
  url.searchParams.set("value", value);
  return Response.redirect(url.toString(), 303);
}

/** The platform's own ceiling on this invocation, in seconds (issue
 *  #438). Vercel reads it out of the build output and freezes the function
 *  at it; on the plan this product deploys to that is 60.
 *
 *  **It is not the report ceiling, and the two are different kinds of
 *  fact.** `TIMING.reportCeilingS` (90) is the design figure the pass
 *  bounds itself by — ADR-021's, unraisable at runtime — and this is the
 *  platform's bound on how long the process the pass runs in exists at
 *  all. Where they disagree the platform wins, so a pass that outlives
 *  this number is frozen mid-flight; the row it left `running` is finished
 *  by the maintenance tick's sweep (`src/lib/scan/stuck.ts`) rather than
 *  left to block the next visitor's admission for ever.
 *
 *  **A literal, and it has to be one.** Next reads route segment config
 *  out of the source at build time
 *  (`next/dist/build/analysis/get-page-static-info`), so an imported
 *  binding is not a value it can see — this number cannot be reached from
 *  `constants.ts` the way every other pin is. It is spelled once, here:
 *  nothing else in the product carries the platform's ceiling. */
export const maxDuration = 60;

/** Starts the free pass and keeps it alive past the response.
 *
 *  **`after()`, never a dangling promise** (issue #438). This used to
 *  start the pass as an abandoned promise — a dynamic import whose
 *  `.then(runScan)` nobody held — which works on a long-lived server and
 *  does nothing at all on a serverless one: the invocation is frozen
 *  the moment the response is returned, so the pass never ran, the row
 *  stayed `running` at zero cents with no `fetches` rows, and every later
 *  visitor to that domain was refused for a scan in flight that would
 *  never finish. `after` is the seam that says "this work belongs to the
 *  request even though the response has gone" — Next hands it to the
 *  platform's `waitUntil`, which extends the invocation until it settles,
 *  up to `maxDuration` above.
 *
 *  The engine is still reached through a dynamic import, for the reason it
 *  always was: the three responses that start no scan — a malformed value,
 *  a malformed body, a refusal — load none of it.
 *
 *  `runScan` never rejects for a domain it cannot measure — every such
 *  ending is a stored report or a `failed` status — so the `catch` here is
 *  for the unforeseen only, and it logs rather than failing a response
 *  that has already gone out. */
function startPipeline(domain: string, scanId: string): void {
  after(async () => {
    try {
      const { runScan } = await import("@/lib/scan/run");
      await runScan({ domain, tier: "free" });
    } catch (error: unknown) {
      console.log(
        JSON.stringify({
          event: "scan_start_failed",
          scanId,
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (body.transport === "malformed") {
    return Response.json({ error: "malformed request body" }, { status: 400 });
  }
  const isForm = body.transport === "form";

  const parsed = parseDomain(body.value);
  if (!parsed.ok) {
    if (isForm) return landingRedirect(request, parsed.problem, body.value);
    return Response.json({ ok: false, problem: parsed.problem } satisfies StartScanResponse, { status: 422 });
  }

  const location = canonicalLocation(parsed.domain);
  const network = networkKeyOf(request.headers.get("x-forwarded-for"));

  const claim = await claimFreeScanSlot({
    domain: parsed.domain,
    network,
    fromIncompleteRescan: false,
  });

  // `## Steps` step 5: on a claim, respond with the new scan's id; on a
  // refusal, respond with the canonical location and no scan id, except
  // where admission returned an `in_flight` refusal of this same domain —
  // there, the union carries the *running* scan's id, so a visitor who
  // joins a scan already in progress for the domain they asked for is
  // handed the same id a fresh claim would have returned.
  const scanId = claim.claimed
    ? claim.scanId
    : "refuse" in claim.refusal && claim.refusal.refuse === "in_flight" && claim.refusal.sameDomain
      ? claim.refusal.runningScanId
      : undefined;

  // The starter half (BP-022 decision 3). A claim that produced a new
  // scan id starts the pipeline; a refusal starts nothing, and an
  // `in_flight` refusal of this same domain hands back the id of the pass
  // already running rather than starting a second. The pipeline is not
  // awaited: the visitor's next request is the progress stream
  // (`GET /api/scan/{scanId}/progress`), which replays the stages this
  // pass publishes as it runs. Its own two ceilings bound the pass and
  // `maxDuration` bounds the invocation it runs in; nothing here does.
  if (claim.claimed) startPipeline(parsed.domain, claim.scanId);

  if (isForm) return Response.redirect(new URL(location, request.url).toString(), 303);

  const response: StartScanResponse = scanId === undefined ? { ok: true, location } : { ok: true, location, scanId };
  return Response.json(response, { status: 200 });
}
