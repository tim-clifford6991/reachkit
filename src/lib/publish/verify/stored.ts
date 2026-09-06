// BUILD §9 — the one shape `publications.verify` takes on disk, and the
// only reader of it.
//
// The **discriminant is stored**: a reader cannot obtain the four check
// outcomes without having gone through the arm that produces them, which is
// what makes ADR-085's separation survive a round trip through `jsonb`.
// `page_not_found` and `could_not_confirm` carry different payloads on
// disk, exactly as they do in the type, so a row cannot be read back into
// one collapsed shape.
//
// A row this reader cannot make sense of is `null`, never a fabricated
// outcome: the check is then simply not recorded, and `dueNow` will offer
// the publication again — which is the safe direction, since no assertion
// about the page has been manufactured from a payload nobody wrote.
//
// Declared in its own module so `due.ts`, `verify.ts` and `site.ts` each
// read the column through one projection and none of them imports another.
import { measured, unmeasured, type Measured, type UnmeasuredReason } from "@/lib/measure/measured";
import type { NotConfirmed, SiteCondition, SiteConditionKind, VerifyChecks, VerifyOutcome } from "../types";
import { CHECK_IDS, type CheckId } from "./checks";

/** What one recorded check holds: the outcome, and the condition of the
 *  site it was found on where this check found one. The site condition
 *  lives inside this jsonb rather than on `destinations` — a fact this node
 *  observes does not belong in a row the destination health check owns, and
 *  a second column would be a second place to keep it in step. */
export interface RecordedCheck {
  result: VerifyOutcome;
  siteCondition: SiteCondition | null;
}


const CONDITION_KINDS: readonly SiteConditionKind[] = ["publishes_no_sitemap", "robots_blocks_site"];
const NOT_CONFIRMED: readonly NotConfirmed[] = [
  "unreachable",
  "server_error",
  "redirected_away",
  "not_our_page",
];

function measuredToJson(m: Measured<boolean>): Record<string, unknown> {
  return m.kind === "unmeasured"
    ? { kind: m.kind, reason: m.reason, at: m.at.toISOString() }
    : { kind: m.kind, value: m.value, at: m.at.toISOString() };
}

/** The JSON-safe projection written to `publications.verify`. */
export function toStoredCheck(recorded: RecordedCheck): Record<string, unknown> {
  const { result } = recorded;
  const common = {
    checkedAt: result.checkedAt.toISOString(),
    siteCondition:
      recorded.siteCondition === null
        ? null
        : {
            kind: recorded.siteCondition.kind,
            foundAt: recorded.siteCondition.foundAt.toISOString(),
          },
  };

  switch (result.outcome) {
    case "found":
      return {
        ...common,
        outcome: "found",
        checks: Object.fromEntries(
          CHECK_IDS.map((id) => [id, measuredToJson(result.checks[id])])
        ),
      };
    case "page_not_found":
      return { ...common, outcome: "page_not_found", status: result.status };
    case "could_not_confirm":
      return { ...common, outcome: "could_not_confirm", why: result.why };
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

function readMeasured(value: unknown): Measured<boolean> | null {
  const row = asObject(value);
  if (row === null) return null;
  const at = asDate(row.at);
  if (at === null) return null;
  if (row.kind === "unmeasured") {
    const reason = row.reason;
    if (reason !== "undeterminable" && reason !== "not_attempted") return null;
    return unmeasured<boolean>(reason as UnmeasuredReason, at);
  }
  if (row.kind !== "measured" && row.kind !== "zero") return null;
  if (typeof row.value !== "boolean") return null;
  return row.kind === "measured"
    ? measured(row.value, at)
    : { kind: "zero", value: row.value, at };
}

function readChecks(value: unknown): VerifyChecks | null {
  const row = asObject(value);
  if (row === null) return null;
  const out: Partial<Record<CheckId, Measured<boolean>>> = {};
  for (const id of CHECK_IDS) {
    const one = readMeasured(row[id]);
    if (one === null) return null;
    out[id] = one;
  }
  return out as VerifyChecks;
}

function readCondition(value: unknown): SiteCondition | null {
  const row = asObject(value);
  if (row === null) return null;
  const foundAt = asDate(row.foundAt);
  if (foundAt === null) return null;
  if (!CONDITION_KINDS.includes(row.kind as SiteConditionKind)) return null;
  return { kind: row.kind as SiteConditionKind, foundAt };
}

/**
 * Reads one `publications.verify` payload back.
 *
 * Total: any value, including `null` and a shape nothing in this product
 * wrote, answers `null`. It never throws and never invents an arm.
 */
export function readStoredCheck(payload: unknown): RecordedCheck | null {
  const row = asObject(payload);
  if (row === null) return null;
  const checkedAt = asDate(row.checkedAt);
  if (checkedAt === null) return null;
  const siteCondition = readCondition(row.siteCondition);

  if (row.outcome === "found") {
    const checks = readChecks(row.checks);
    if (checks === null) return null;
    return { result: { outcome: "found", checks, checkedAt }, siteCondition };
  }
  if (row.outcome === "page_not_found") {
    if (row.status !== 404 && row.status !== 410) return null;
    return { result: { outcome: "page_not_found", status: row.status, checkedAt }, siteCondition };
  }
  if (row.outcome === "could_not_confirm") {
    if (!NOT_CONFIRMED.includes(row.why as NotConfirmed)) return null;
    return {
      result: { outcome: "could_not_confirm", why: row.why as NotConfirmed, checkedAt },
      siteCondition,
    };
  }
  return null;
}
