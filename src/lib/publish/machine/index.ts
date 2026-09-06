// BUILD §9 — `transition()`, the only mover of state.
//
// Nothing else in the product writes `drafts.state`. Every move goes
// through here, is checked against the fifteen edges, and is recorded — the
// state change and the record are **one statement** (`publish_transition`,
// `supabase/migrations/20260906120100_drafts_publishing.sql`), so a state
// that moved without a record is not a bug this code could have but a
// write Postgres cannot perform.
//
// Order, and it matters:
//   1. membership — a move outside the fifteen writes nothing at all;
//   2. the named guards, in list order, lazily, first failure wins;
//   3. the update-and-append, conditional on the state still being the one
//      that was checked (an optimistic lock, so two concurrent movers
//      cannot both win).
//
// The refusal is a value, never an exception, and never leaves the page
// somewhere else: `state` in the refusal is the state the page still holds.
//
// The archived plan is WO-209.
import { VETO } from "@/lib/config/constants";
import { publishDb } from "../db";
import type { Actor, DraftView, State, ToldRecord, TransitionRecord } from "../types";
import {
  DEFAULT_GUARD_DEPS,
  GUARD_FNS,
  type GuardDeps,
  type MachineDraft,
} from "./guards";
import { GUARDS, STATES, TERMINAL, TRANSITIONS, edgeKey, type GuardId, type Refusal } from "./table";

export { STATES, TRANSITIONS, TERMINAL, GUARDS, edgeKey };
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
  | { ok: false; refused: Refusal; failedGuard?: GuardId; state: State };

export interface TransitionOptions {
  reason?: string;
  /** The guard dependencies. Injected so a caller under test drives one
   *  guard without a database, and so #46 supplies the publishable rule by
   *  passing it rather than by editing this file. */
  deps?: GuardDeps;
  /** The clock the guards are evaluated against. Defaults to now; a caller
   *  that already fixed a moment passes it so the ceilings and the
   *  publishable rule agree with the rest of its own pass. */
  at?: Date;
}

/** Is this pair one of the fifteen? Data, not a switch — the table is the
 *  only place the edges exist. */
export function isTransition(from: State, to: State): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export async function transition(
  draftId: string,
  to: State,
  by: Actor,
  options: TransitionOptions = {}
): Promise<TransitionResult> {
  const at = options.at ?? new Date();
  const draft = await loadDraft(draftId);
  if (draft === null) {
    // No row is not a refusal of a move — there is no page to move and no
    // state to report. `planned` would be a guess; the caller is told the
    // move was not one of the fifteen for a page that does not exist.
    return { ok: false, refused: "not_a_transition", state: to };
  }

  const from = draft.state;

  if (!isTransition(from, to)) {
    log({ draftId, from, to, actor: by.kind, outcome: "refused", refused: "not_a_transition" });
    return { ok: false, refused: "not_a_transition", state: from };
  }

  const deps = options.deps ?? DEFAULT_GUARD_DEPS;
  for (const guard of GUARDS[edgeKey(from, to)] ?? []) {
    const passed = await GUARD_FNS[guard]({ draft, by, at, deps });
    if (!passed) {
      log({
        draftId,
        from,
        to,
        actor: by.kind,
        outcome: "refused",
        refused: "guard",
        failedGuard: guard,
      });
      return { ok: false, refused: "guard", failedGuard: guard, state: from };
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
    // The row moved under us — another mover won the optimistic lock. The
    // page is not where this call thought it was, so nothing was written
    // and nothing is claimed about where it is now.
    log({ draftId, from, to, actor: by.kind, outcome: "refused", refused: "not_a_transition" });
    return { ok: false, refused: "not_a_transition", state: from };
  }

  log({ draftId, from, to, actor: by.kind, outcome: "moved" });
  return { ok: true, state: to };
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

/** One structured line per call. Every field is an id or a name from a
 *  closed union — never a credential, never a vendor payload, never a
 *  sentence, and never the draft's own text. */
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

async function loadDraft(draftId: string): Promise<MachineDraft | null> {
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

/** The row as the machine reads it.
 *
 *  The two members #44's generation columns will populate
 *  (`hasUnsavedEdit`, `claimRecheckOutstanding`) read `false` where the
 *  column is absent, and the hard-rule outcome reads `false` unless the
 *  row records it — the conservative arm every time: a draft that has not
 *  recorded passing the hard rules has not passed them.
 *
 *  `told` is the **record**, not a verdict: whether the customer has been
 *  told on the pair now in force is decided by comparing it against
 *  `governing`, and that comparison is the veto leaf's (`toldCurrentPair`).
 *  A row with no record has never been told, which holds the page.
 *
 *  `publishTime` and `timezone` are on the pair because REQ-073 c4's change
 *  — the one REQ-057 c8 tracks — includes both, and either one moves *when*
 *  a page publishes. A null zone travels as null; nothing here substitutes
 *  the server's. */
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
      mode: row.sites?.mode === "copilot" ? "copilot" : "autopilot",
      vetoHours: typeof row.sites?.veto_hours === "number" ? row.sites.veto_hours : VETO.defaultHours,
      publishTime: publishTimeOf(row.sites?.publish_time ?? null),
      timezone: typeof row.sites?.timezone === "string" ? row.sites.timezone : null,
    },
  };
  return { ...view, hardRulesPassed: row.hard_rules_passed === true, transitions };
}

/** BUILD §10's own column default (`publish_time time not null default
 *  '09:00'`), read back as `HH:mm` — the column renders seconds the pair
 *  never carries. Not a second decision about the hour: the same value the
 *  column already holds. */
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
