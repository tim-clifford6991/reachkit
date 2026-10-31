// BUILD §9 — `transition()`, the only mover of state: nothing else writes `drafts.state`. The state change and its
// record are one statement (`publish_transition`), so a move without a record is a write Postgres cannot perform.
// In order:
//   1. membership: a move outside the seventeen writes nothing;
//   2. the named guards, in list order, lazily, first failure wins;
//   3. the update-and-append, conditional on the checked state (an optimistic lock, so two movers cannot both win).
// A refusal is a value, never an exception, and its `state` is the one the page still holds.
import type { StopReason } from "../record/needs-you";
import { governingVetoHours } from "../settings/veto";
import { publishDb } from "../db";
import type { Actor, DraftView, State, ToldRecord, TransitionRecord } from "../types";
import {
  DEFAULT_GUARD_DEPS,
  GUARD_FNS,
  type GuardDeps,
  type MachineDraft,
} from "./guards";
import {
  GUARDS,
  STATES,
  TERMINAL,
  TRANSITIONS,
  edgeKey,
  isTransition,
  type GuardId,
  type Refusal,
} from "./table";

export { STATES, TRANSITIONS, TERMINAL, GUARDS, edgeKey, isTransition };
export type { GuardId, Refusal };
export {
  DEFAULT_GUARD_DEPS,
  GUARD_FNS,
  PUBLISHABLE_RULE_NOT_BUILT,
  type GuardDeps,
  type GuardContext,
  type MachineDraft,
  type PublishableRule,
} from "./guards";

export type TransitionResult =
  | { ok: true; state: State }
  | {
      ok: false;
      refused: Refusal;
      failedGuard?: GuardId;
      state: State;
      /** Where `no_outstanding_claim_recheck` refused and the last check named an entry: the customer's own words.
       *  Absent for a stale list hash, so no claim is attributed to them. */
      matchedEntry?: string;
    };

export interface TransitionOptions<To extends State = State> {
  /** A move into `needs_attention` names a classified cause, so whether it is told is decided where it is written. */
  reason?: "needs_attention" extends To ? (State extends To ? string : StopReason) : string;
  /** The guard dependencies, injected so a test drives one guard without a database. */
  deps?: GuardDeps;
  /** The guards' clock; a caller that fixed a moment passes it so its whole pass agrees. */
  at?: Date;
}

export async function transition<To extends State>(
  draftId: string,
  to: To,
  by: Actor,
  options: TransitionOptions<To> = {}
): Promise<TransitionResult> {
  const at = options.at ?? new Date();
  const draft = await machineDraftFor(draftId);
  if (draft === null) {
    // No page: `planned` would be a guess, so the move is simply not a transition.
    return { ok: false, refused: "not_a_transition", state: to };
  }

  const from = draft.state;

  if (!isTransition(from, to)) {
    log({ draftId, from, to, actor: by.kind, outcome: "refused", refused: "not_a_transition" });
    return { ok: false, refused: "not_a_transition", state: from };
  }

  const deps = options.deps ?? DEFAULT_GUARD_DEPS;

  // BUILD §8 hard rule 4 · REQ-053 c5 — the hand-off gate and the one read of the claim re-check, only on edges into
  // `publishing`; the guard and the publishable rule's fourth conjunct see the same value.
  const gated: MachineDraft =
    to === "publishing"
      ? { ...draft, claimRecheckOutstanding: await deps.claimRecheckOutstanding(draftId) }
      : draft;

  for (const guard of GUARDS[edgeKey(from, to)] ?? []) {
    const passed = await GUARD_FNS[guard]({ draft: gated, by, at, deps });
    if (!passed) {
      // The customer's own words travel in the refusal, never into the log line.
      const held =
        guard === "no_outstanding_claim_recheck" ? await deps.outstandingMatch(draftId) : null;
      log({
        draftId,
        from,
        to,
        actor: by.kind,
        outcome: "refused",
        refused: "guard",
        failedGuard: guard,
      });
      return {
        ok: false,
        refused: "guard",
        failedGuard: guard,
        state: from,
        ...(held === null ? {} : { matchedEntry: held.matchedEntry }),
      };
    }
  }

  const record: TransitionRecord = {
    from,
    to,
    actor: by,
    ...(options.reason === undefined ? {} : { reason: options.reason }),
    at: at.toISOString(),
  };

  const { data, error } = await publishDb().rpc<boolean>("publish_transition", {
    p_draft_id: draftId,
    p_from: from,
    p_to: to,
    p_record: record as unknown as Record<string, unknown>,
  });

  if (error !== null || data !== true) {
    // Another mover won the optimistic lock: nothing was written, and nothing is claimed about where the page is.
    log({ draftId, from, to, actor: by.kind, outcome: "refused", refused: "not_a_transition" });
    return { ok: false, refused: "not_a_transition", state: from };
  }

  log({ draftId, from, to, actor: by.kind, outcome: "moved" });
  // The recheck's retire leaves the topic as the stop left it, so a topic since un-rested stays un-rested.
  const retired = to === "skipped" && by.kind === "system" && by.job === "draft/recheck";
  if ((to === "skipped" && !retired) || (from === "needs_attention" && to === "in_review")) {
    await settleOpportunityOf(draftId, from, to, at);
  }
  return { ok: true, state: to };
}

/** SPEC §7: "a vetoed draft dismisses" its opportunity, except for a draft the generator stopped (D26):
 *   - skipping it refuses the page, not the target: the topic rests for `TOPIC_REST_DAYS` and can fill a later day;
 *   - the founder's passing edit takes it into review, and the topic is queued behind its page.
 *  Here, the one place every move is made. After the move, never undoing it; imported at the call, as in `guards.ts`. */
async function settleOpportunityOf(draftId: string, from: State, to: State, at: Date): Promise<void> {
  try {
    const { data } = await publishDb()
      .from<{ opportunity_id: string | null; transitions: unknown }>("drafts")
      .select("opportunity_id, transitions")
      .eq("id", draftId)
      .limit(1);
    const opportunityId = data?.[0]?.opportunity_id ?? null;
    if (opportunityId === null) return;
    const { dismissForVeto, queueForDraft, restTopic } = await import("@/lib/opportunities");
    if (to === "in_review") {
      await queueForDraft(opportunityId);
    } else if (from === "needs_attention" && restedFromGenerating(data?.[0]?.transitions)) {
      await restTopic(opportunityId, at);
    } else {
      await dismissForVeto(opportunityId);
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "opportunity_dismiss_failed",
        draftId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/** Whether the last move into `needs_attention` came from `generating`: stopped by the generator, not a failed publish. */
function restedFromGenerating(transitions: unknown): boolean {
  if (!Array.isArray(transitions)) return false;
  const rested = [...(transitions as Partial<TransitionRecord>[])].reverse().find((move) => move?.to === "needs_attention");
  return rested?.from === "generating";
}

interface TransitionLog {
  draftId: string;
  from: State;
  to: State;
  actor: Actor["kind"];
  outcome: "moved" | "refused";
  refused?: Refusal;
  failedGuard?: GuardId;
}

/** One line per call: ids and closed-union names only, never a credential, payload, sentence or draft text. */
function log(line: TransitionLog): void {
  console.log(JSON.stringify({ event: "publish_transition", ...line }));
}

interface DraftRow {
  id: string;
  site_id: string;
  state: string;
  veto_deadline: string | null;
  approved_at: string | null;
  approved_by: unknown;
  told: unknown;
  transitions: unknown;
  hard_rules_passed: boolean | null;
  publishable_since: string | null;
  sites?: {
    mode?: string | null;
    veto_hours?: number | null;
    publish_time?: string | null;
    timezone?: string | null;
  } | null;
}

/** The draft as the machine reads it, exported so the `draft-ready` mail reads the pair and told record through the same
 *  select and mapping, never a second answer to "what was this customer told?". */
export async function machineDraftFor(draftId: string): Promise<MachineDraft | null> {
  const { data, error } = await publishDb()
    .from<DraftRow>("drafts")
    .select(
      "id, site_id, state, veto_deadline, approved_at, approved_by, told, transitions, hard_rules_passed, publishable_since, sites(mode, veto_hours, publish_time, timezone)"
    )
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;
  return toMachineDraft(data);
}

/** The row as the machine reads it, conservative every time: unrecorded hard rules have not passed.
 *  `claimRecheckOutstanding` is `false` here and derived by `transition()` on edges into `publishing`; it is not stored.
 *  `told` is the record, not a verdict: `toldCurrentPair` compares it with `governing`, and none holds the page.
 *  `publishTime` and `timezone` are on the pair because either moves when a page publishes (REQ-073 c4); a null zone stays null. */
export function toMachineDraft(row: DraftRow): MachineDraft {
  const state = STATES.find((candidate) => candidate === row.state) ?? "planned";
  const transitions = Array.isArray(row.transitions)
    ? (row.transitions as TransitionRecord[])
    : [];
  const view: DraftView = {
    id: row.id,
    siteId: row.site_id,
    state,
    vetoDeadline: row.veto_deadline === null ? null : new Date(row.veto_deadline),
    approvedAt: row.approved_at === null ? null : new Date(row.approved_at),
    approvedBy: actorOf(row.approved_by),
    hasUnsavedEdit: false,
    claimRecheckOutstanding: false,
    told: toldOf(row.told),
    governing: {
      mode: "autopilot",
      vetoHours: governingVetoHours(row.sites?.veto_hours),
      publishTime: publishTimeOf(row.sites?.publish_time ?? null),
      timezone: typeof row.sites?.timezone === "string" ? row.sites.timezone : null,
    },
  };
  return { ...view, hardRulesPassed: row.hard_rules_passed === true, transitions };
}

/** BUILD §10's column default (`default '09:00'`), read back as `HH:mm`; the same value, never a second decision. */
function publishTimeOf(value: string | null): string {
  if (value === null) return "09:00";
  const [hh = "09", mm = "00"] = value.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function actorOf(value: unknown): Actor | null {
  const actor = value as Actor | null;
  if (actor === null || typeof actor !== "object") return null;
  return actor.kind === "customer" || actor.kind === "system" ? actor : null;
}

function toldOf(value: unknown): ToldRecord | null {
  const record = value as ToldRecord | null;
  if (record === null || typeof record !== "object") return null;
  return typeof record.pair === "object" && record.pair !== null ? record : null;
}
