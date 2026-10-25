// BUILD §9 — the one on-disk shape of `publications.verify`, and its only reader, shared by `due.ts`, `verify.ts` and `site.ts`.
// The discriminant is stored, so ADR-085's separation of `page_not_found` and `could_not_confirm` survives `jsonb`.
// An unreadable row is `null`, never a fabricated outcome, and `dueNow` offers the publication again.
import { measured, unmeasured, type Measured, type UnmeasuredReason } from "@/lib/measure/measured";
import type { NotConfirmed, SiteCondition, SiteConditionKind, VerifyChecks, VerifyOutcome } from "../types";
import { CHECK_IDS, type CheckId } from "./checks";

/** One recorded check: the outcome, and the site condition it found, kept here rather than on `destinations`. */
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

/** Reads one payload back. Total: anything unrecognised is `null`; it never throws and never invents an arm. */
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
