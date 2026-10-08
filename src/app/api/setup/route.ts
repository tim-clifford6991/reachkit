// src/app/api/setup/route.ts — BUILD §4.3
//
// The one write path into setup completion (REQ-025 c2: "one action starts
// the product"). A transport adapter and nothing else (`ARCHITECTURE.md`
// rule 1): it parses the body to the closed `SetupSubmission` shape, calls
// `completeSetup()`, and maps `SetupResult` to a response. It holds no
// engine logic, no SQL and no sentence.
//
// **`siteId` is never read from the request body.** It comes from the
// account behind the session, through the store — a founder cannot name
// another founder's site by editing a payload.
//
// **Five saved steps plus a finish, since 2026-09-20 (#922).** SPEC §5:
// "Each step saves as it is left so a reload resumes." A body naming a
// `step` is that step's own save, narrowed to the one arm of
// `SetupStepSave` it claims and answered with `SetupStepResult`; a body
// with no `step`, or one naming `finish`, is the finish and goes through
// `completeSetup` exactly as it always has. Both refuse with the same
// handles, so the screen has one line per refusal and no second vocabulary
// for a step.
//
// **The account is the session's, since #133.** `currentSession()`
// (BP-061, #35, on Supabase Auth since #468) is the whole of it: Supabase
// verifies the session and the account's tombstone is checked there, and
// this file adds no claim of its own. `src/middleware.ts` has already
// refused a request that carries no cookie at all, so the `null` arm below
// is the forged, expired or ended one — answered the way every other
// account endpoint answers it, with a status and no sentence.
import { founderAnswers } from "@/lib/site-profile/knowledge/types";
import { adapter } from "../_adapter";
import {
  completeSetup,
  saveSetupStep,
  type SetupResult,
  type SetupStepSave,
  type SetupSubmission,
} from "@/app/(account)/setup/submit";
import { isSetupStep } from "@/app/(account)/setup/steps";
import { setupStore } from "@/app/(account)/setup/_setup/provider";
import { currentSession } from "@/lib/account/identity";
import { DEFAULT_HOSTED_LABEL } from "@/lib/publish/destinations/hosted/label";
import { BUSINESS_LISTS, type BusinessList } from "@/lib/site-profile/business/types";

const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;
const REFUSED = 422;

/** The name the finish goes by on the wire. A body carrying it — or no
 *  `step` at all, which is the shape this route answered before the five
 *  steps existed — is read as a `SetupSubmission`. */
const FINISH = "finish";

/**
 * Narrows an unknown body to one arm of `SetupStepSave`, or to `null` where
 * the body is not a step save at all. A body naming a step it then fails to
 * carry the answer for is `undefined` — malformed, and a 400 — which is a
 * different answer from "this is the finish".
 */
function parseStepSave(body: unknown): SetupStepSave | null | undefined {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const step = b.step;
  if (step === undefined || step === FINISH) return null;
  if (!isSetupStep(step)) return undefined;

  switch (step) {
    case "site":
      if (typeof b.domain !== "string" || typeof b.category !== "string") return undefined;
      return {
        step,
        domain: b.domain,
        category: b.category,
        ...(typeof b.locale === "string" ? { locale: b.locale } : {}),
        ...(typeof b.place === "string" ? { place: b.place } : {}),
      };
    case "business": {
      // #970: a record of list name to strings. A key the tuple does not
      // name is dropped rather than refused — the browser cannot invent a
      // seventh list, and a body carrying one is not worth a 400 — but a
      // value that is not a list of strings is malformed.
      const lists = parseBusinessLists(b.lists);
      if (lists === undefined) return undefined;
      // #1038: *What you do*, one sentence. Absent is the older body, which
      // leaves the stored wording as it is; anything but a string is malformed.
      // #1133: the five questions. Absent is the older body, which leaves
      // the stored answers as they are; anything but a record is malformed.
      if (b.answers !== undefined && (typeof b.answers !== "object" || b.answers === null || Array.isArray(b.answers))) {
        return undefined;
      }
      const answers = b.answers === undefined ? {} : { answers: founderAnswers(b.answers) };
      if (b.job === undefined) return { step, lists, ...answers };
      if (typeof b.job !== "string") return undefined;
      return { step, lists, job: b.job, ...answers };
    }
    case "rivals":
      if (!Array.isArray(b.competitors) || b.competitors.some((c) => typeof c !== "string")) {
        return undefined;
      }
      return { step, competitors: b.competitors as string[] };
    case "voice":
      if (typeof b.voiceText !== "string") return undefined;
      if (b.timezone !== undefined && b.timezone !== null && typeof b.timezone !== "string") {
        return undefined;
      }
      return { step, voiceText: b.voiceText, timezone: typeof b.timezone === "string" ? b.timezone : null };
    // Publishing has no save of its own: leaving it forward is the finish
    // (`SetupStepSave`), so a body naming it is malformed.
    case "publishing":
      return undefined;
  }
}

/**
 * The business step's lists, narrowed to the six `site_profile_edits`
 * holds (#970).
 *
 * `undefined` is malformed. An absent body member is an empty record — a
 * step left with nothing shown, which touches no list — rather than a
 * refusal the founder would read as their own mistake.
 */
function parseBusinessLists(
  value: unknown
): Readonly<Partial<Record<BusinessList, readonly string[]>>> | undefined {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const out: Partial<Record<BusinessList, readonly string[]>> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!BUSINESS_LISTS.some((list) => list === key)) continue;
    if (!Array.isArray(entry) || entry.some((item) => typeof item !== "string")) return undefined;
    out[key as BusinessList] = entry as string[];
  }
  return out;
}

/** SPEC §5's two destinations, shared by a publishing step and the finish.
 *  A hosted arm with no label is the default the founder was shown — never
 *  a blank first segment, and never a refusal for a field left as found. */
function parseDestination(value: unknown): SetupSubmission["destination"] | null {
  if (typeof value !== "object" || value === null) return null;
  const kind = (value as Record<string, unknown>).kind;
  if (kind !== "hosted" && kind !== "wordpress") return null;
  const label = (value as Record<string, unknown>).label;
  if (label !== undefined && typeof label !== "string") return null;
  return kind === "hosted"
    ? { kind: "hosted", label: label ?? DEFAULT_HOSTED_LABEL }
    : { kind: "wordpress", connectLater: true };
}

/** Narrows an unknown body to `SetupSubmission` without widening it: a
 *  member absent from the type cannot be sent, which is REQ-025 c1's "and
 *  for nothing else" enforced at the wire rather than reviewed. Unknown
 *  members are dropped, never forwarded. */
function parseSubmission(body: unknown): SetupSubmission | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.domain !== "string") return null;
  if (typeof b.category !== "string") return null;
  if (!Array.isArray(b.competitors) || b.competitors.some((c) => typeof c !== "string")) return null;
  // No `mode` (SPEC §7, #476): Autopilot is the only mode, so a `mode` in
  // the body is dropped like any other unknown member.
  // SPEC.md §5 (2026-09-12). A body with no voice is a founder whose site
  // had no profile to confirm: the empty string, never a `null` the store
  // would have to arm for.
  if (b.voiceText !== undefined && typeof b.voiceText !== "string") return null;
  // Issue #783: the browser's zone. Absent is `null` — `BrowserZone` is the
  // fallback — and a value that is not a zone is the store's to ignore,
  // never a refusal of the founder's three answers.
  if (b.timezone !== undefined && b.timezone !== null && typeof b.timezone !== "string") return null;

  // SPEC §5: the hosted arm carries the subdomain label the founder chose.
  // Whether it is *usable* is `completeSetup`'s, which asks the same two
  // questions the screen asked.
  const destination = parseDestination(b.destination);
  if (destination === null) return null;

  return {
    domain: b.domain,
    category: b.category,
    competitors: b.competitors as string[],
    destination,
    voiceText: typeof b.voiceText === "string" ? b.voiceText : "",
    timezone: typeof b.timezone === "string" ? b.timezone : null,
    // D66: the country and language. A value that is not on the list is the
    // store's to ignore, never a refusal of the founder's answers.
    ...(typeof b.locale === "string" ? { locale: b.locale } : {}),
    // D67: the place the business serves, where the founder answered.
    ...(typeof b.place === "string" ? { place: b.place } : {}),
  };
}

export const POST = adapter("POST /api/setup", async (request: Request): Promise<Response> => {
  const session = await currentSession();
  if (session === null) {
    return Response.json({ error: "unauthenticated" }, { status: UNAUTHENTICATED });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }

  // SPEC §5 (2026-09-20, #922): one step's own save, before the finish.
  const save = parseStepSave(body);
  if (save === undefined) {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }
  if (save !== null) {
    const saved = await saveSetupStep(setupStore(), { userId: session.userId, save });
    return Response.json(saved, { status: saved.ok ? 200 : REFUSED });
  }

  const submission = parseSubmission(body);
  if (submission === null) {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }

  const result: SetupResult = await completeSetup(setupStore(), {
    userId: session.userId,
    submission,
  });

  return Response.json(result, { status: result.ok ? 200 : REFUSED });
});
