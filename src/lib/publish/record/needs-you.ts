// BUILD §9, §4.6 — why a page needs the customer, read from its own record, never guessed: a stage alone would offer
// "Reconnect" to a page the writing rules stopped on a healthy destination.
// The cause is the last `→ needs_attention` transition's `reason`, parsed here and nowhere else:
//   `rules:<rule,rule>`             §8 rule 4, the hard rules stopped the writing (`generate`'s `rulesReason`)
//   `step_failed:<step>`            a step could not run, twice
//   `step_failed:adds`              the page adds too little
//   `step_failed:elsewhere`         too close to a page elsewhere
//   `step_failed:pack:<need,need>`  the context pack was short of what the template asks, so nothing was written
//   `reason_needs_customer`         §9, a publish failure no retry could clear (`decideRetry`)
//   `retries_exhausted`             §9, the publish was tried ×3 and did not go
//   `live_edit`                     the customer's own edit of a live page, held until it passes
// Anything else is `unknown`, which claims nothing about why. Pure, so every surface reads one derivation without a db client.
import { DELIVERY_REATTEMPT_DAYS } from "@/lib/config/constants";
import type { State } from "../types";

/** Every reason a writer may record on a move into `needs_attention`; closed, so a new one is classified before it compiles. */
export type StopReason =
  | `rules:${string}`
  | `step_failed:${string}`
  | "reason_needs_customer"
  | "retries_exhausted"
  | "live_edit";

/** Why a page rests in `needs_attention`; closed, each member carrying what its sentence and action need. */
export type NeedsYouCause =
  /** §8's hard rules stopped the writing. The rules are the pipeline's own
   *  handles (`brand_gap`, …), never sentences: the draft screen
   *  lists them as its rails, and the panel states the cause. */
  | { kind: "rules"; rules: readonly string[] }
  /** A step of the pipeline could not run, twice. */
  | { kind: "step"; step: string }
  /** The page adds too little the web and the site do not already say (SPEC §7, D12); it waits on a founder's fact. */
  | { kind: "adds" }
  /** Twice written, it still reads almost the same as a page for another site (SPEC §7, D13); it carries nothing about that page. */
  | { kind: "elsewhere" }
  /** The context pack was short of what the template asks (SPEC §7, D41 stage 2), so nothing was written. `missing` is
   *  the pack's handles (`options`, `own_price`, …), never sentences. */
  | { kind: "pack"; missing: string[] }
  /** Undeliverable for a reason no retry clears; which one is the destination's own state to say. */
  | { kind: "destination" }
  /** The publish was attempted the full three times and did not go. `since` is the first time it rested so, where read. */
  | { kind: "delivery"; since?: string }
  /** The customer's own words break a rule: an edit of a live page, or of a page the writing stopped. They wait on them. */
  | { kind: "live_edit" }
  /** The row records no reason this build can read. */
  | { kind: "unknown" };

export type NeedsYouKind = NeedsYouCause["kind"];
/** The causes that can be critical, and so the only ones with a sentence. */
export type CriticalKind = Extract<NeedsYouKind, "destination" | "delivery" | "live_edit" | "unknown">;

interface TransitionLike {
  to?: unknown;
  from?: unknown;
  reason?: unknown;
}

/** The reason on the last move into `needs_attention`, or `null`; a malformed blob has no cause, never a throw. */
export function restedReasonOf(transitions: unknown): string | null {
  if (!Array.isArray(transitions)) return null;
  const rested = [...(transitions as TransitionLike[])]
    .reverse()
    .find((move) => move !== null && typeof move === "object" && move.to === "needs_attention");
  return typeof rested?.reason === "string" && rested.reason !== "" ? rested.reason : null;
}

/** The cause a recorded reason names; `null` or unrecognised is `unknown`. */
export function needsYouCauseOf(reason: string | null): NeedsYouCause {
  if (reason === null) return { kind: "unknown" };
  if (reason.startsWith("rules:")) {
    const rules = reason
      .slice("rules:".length)
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");
    return { kind: "rules", rules };
  }
  if (reason.startsWith("step_failed:")) {
    const step = reason.slice("step_failed:".length).trim();
    if (step === "adds") return { kind: "adds" };
    if (step === "elsewhere") return { kind: "elsewhere" };
    if (step === "pack" || step.startsWith("pack:")) {
      const missing = step
        .slice("pack:".length)
        .split(",")
        .map((need) => need.trim())
        .filter((need) => need !== "");
      return { kind: "pack", missing };
    }
    return { kind: "step", step };
  }
  if (reason === "reason_needs_customer") return { kind: "destination" };
  if (reason === "retries_exhausted") return { kind: "delivery" };
  if (reason === "live_edit") return { kind: "live_edit" };
  return { kind: "unknown" };
}

/** The causes the writing stops a page with, which the daily re-check rescues or sets aside. */
const WRITING_STOPS: ReadonlySet<NeedsYouKind> = new Set(["rules", "step", "adds", "elsewhere", "pack"]);

/** The cause for a page resting in `needs_attention`; `null` in any other state. A stopped page the customer edited
 *  holds their words, which no re-check touches, so it is theirs to act on. */
export function needsYouOf(a: { state: State; transitions: unknown; meta: unknown }): NeedsYouCause | null {
  if (a.state !== "needs_attention") return null;
  const cause = needsYouCauseOf(restedReasonOf(a.transitions));
  const edited = typeof (a.meta as { first_edited_at?: unknown } | null)?.first_edited_at === "string";
  if (edited && WRITING_STOPS.has(cause.kind)) return { kind: "live_edit" };
  const since = cause.kind === "delivery" ? exhaustedSince(a.transitions) : null;
  return since === null ? cause : { kind: "delivery", since };
}

/** Whether the daily re-check set the page aside: `skipped`, its last move carrying a `retired:<cause>` reason. */
export function setAsideOf(a: { state: State; transitions: unknown }): boolean {
  if (a.state !== "skipped" || !Array.isArray(a.transitions)) return false;
  const reason = (a.transitions as TransitionLike[]).at(-1)?.reason;
  return typeof reason === "string" && reason.startsWith("retired:");
}

/** When the page first rested with its publish tried to exhaustion, or `null`. */
export function exhaustedSince(transitions: unknown): string | null {
  if (!Array.isArray(transitions)) return null;
  const first = (transitions as TransitionLike[]).find(
    (move) => move !== null && typeof move === "object" && move.to === "needs_attention" && move.reason === "retries_exhausted"
  ) as (TransitionLike & { at?: unknown }) | undefined;
  return typeof first?.at === "string" ? first.at : null;
}

/** Whether it waits on the destination: the two delivery causes only. The reconnect control turns on this, never a stage. */
export function waitsOnDestination(cause: NeedsYouCause | null): boolean {
  return cause !== null && (cause.kind === "destination" || cause.kind === "delivery");
}

/** Whether the cause is critical for the customer (owner O7): a destination they must fix, their own words, or a cause
 *  this build cannot read. A page the writing stopped is the system's to rescue or set aside, and a publish that did not
 *  go is re-attempted daily until it is older than `DELIVERY_REATTEMPT_DAYS`. Only a critical cause is told; no cause is none. */
export function critical(cause: NeedsYouCause | null, now: Date): boolean {
  switch (cause?.kind) {
    case undefined:
      return false;
    case "destination":
    case "live_edit":
    case "unknown":
      return true;
    case "delivery":
      return cause.since === undefined || now.getTime() - Date.parse(cause.since) > DELIVERY_REATTEMPT_DAYS * 86_400_000;
    case "rules":
    case "step":
    case "adds":
    case "elsewhere":
    case "pack":
      return false;
  }
}
