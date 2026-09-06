// BUILD §9 — the veto link: one hashed, single-use, draft-bound token that
// expires at the veto deadline and performs exactly one transition.
//
// §9 and REQ-057 c1: the customer "is given a single action to stop it".
// This is that action, and it is *one* action — a second use stops nothing
// further, because the page has already left review and no edge leads back
// into it.
//
// What the token is:
//
//   - 32 bytes from a CSPRNG, encoded for a URL;
//   - stored as its SHA-256 hash and never in the clear, so a database read
//     yields no usable stop link;
//   - bound to one draft, expiring at that draft's `veto_deadline`;
//   - marked used in the **same statement that reads it**
//     (`redeem_veto_token`), so a double click cannot skip twice.
//
// **No token at a veto window of zero** (REQ-057 c7): there is no interval
// in which one could be used, so none is issued and nothing is written.
// What the customer is offered instead is taking the page down, which is
// `unpublish()`'s and this module names none of it.
//
// **Refusals disclose nothing.** `unknown` and `expired` name no draft.
// A customer who clicks after the page published gets `not_in_review`,
// which is the value the surface reads to offer the take-down instead of a
// silent failure.
//
// No log line in this file carries a token or its hash.
//
// The archived plan is WO-217.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { VETO_TOKEN_BYTES } from "@/lib/config/constants";
import { publishDb } from "../db";
import { transition } from "../machine";
import type { Actor, VetoLink } from "../types";

export type VetoRefusal = "unknown" | "expired" | "not_in_review";

export type RedeemResult =
  | { ok: true; draftId: string }
  | { ok: false; reason: VetoRefusal };

/** The hash stored in `drafts.veto_token_hash`. Hex, so the column holds a
 *  fixed-width value and the comparison the database makes is on the hash,
 *  never on the token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two hashes.
 *
 * The database lookup is an equality filter and is not itself constant
 * time; this is the comparison every path that has both hashes in hand
 * makes, so no code in this module leaks a token through timing.
 */
export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Issues the stop link for a draft.
 *
 * At a veto window of zero — a `veto_deadline` at or before the moment the
 * draft entered review, which is what a zero window produces — nothing is
 * written and `{ token: '', expiresAt: null }` comes back. That is not a
 * failure: REQ-057 c7 says no interval exists, so a link would be an offer
 * the product cannot keep.
 */
export async function issueVetoLink(draftId: string, at: Date = new Date()): Promise<VetoLink> {
  const deadline = await readDeadline(draftId);
  if (deadline === null || deadline.getTime() <= at.getTime()) {
    return { token: "", expiresAt: null };
  }

  const token = randomBytes(VETO_TOKEN_BYTES).toString("base64url");
  const { error } = await publishDb()
    .from<never>("drafts")
    .update({
      veto_token_hash: hashToken(token),
      veto_token_expires_at: deadline.toISOString(),
      veto_token_used_at: null,
    })
    .eq("id", draftId);
  if (error !== null) {
    throw new Error("src/lib/publish/publishable: could not issue the stop link");
  }

  return { token, expiresAt: deadline };
}

/**
 * Redeems a token: marks it used and takes `in_review → skipped` through
 * `transition()` with a customer actor.
 *
 * Exactly one transition and nothing else. The move goes through the
 * machine — never by a direct write — so the veto is one of §9's fifteen
 * edges and is recorded like every other move.
 */
export async function redeemVeto(
  token: string,
  by: Actor,
  at: Date = new Date()
): Promise<RedeemResult> {
  if (token.length === 0) return { ok: false, reason: "unknown" };

  const hash = hashToken(token);
  const { data, error } = await publishDb().rpc<{ draft_id: string; state: string }[]>(
    "redeem_veto_token",
    { p_token_hash: hash, p_now: at.toISOString() }
  );
  if (error !== null) return { ok: false, reason: "unknown" };

  const [row] = data ?? [];
  if (row === undefined) {
    // No row: the token is unknown, already used, or past its expiry. The
    // database cannot tell us which without a second read that would
    // disclose whether a draft exists, so the honest answer to a caller who
    // presented an unusable token is that it did not work. `expired` is
    // reserved for the case the caller can prove.
    return { ok: false, reason: await expiredOrUnknown(hash, at) };
  }

  if (row.state !== "in_review") return { ok: false, reason: "not_in_review" };

  const moved = await transition(row.draft_id, "skipped", by, { at, reason: "veto" });
  if (!moved.ok) return { ok: false, reason: "not_in_review" };
  return { ok: true, draftId: row.draft_id };
}

/**
 * Which of the two an unusable token was.
 *
 * The read is by hash and returns one column — the expiry — so a caller
 * learns "your link ran out" rather than "your link is not a link", and
 * learns nothing about which draft it belonged to or whether one exists.
 */
async function expiredOrUnknown(hash: string, at: Date): Promise<"unknown" | "expired"> {
  const { data, error } = await publishDb()
    .from<{ veto_token_expires_at: string | null; veto_token_hash: string }>("drafts")
    .select("veto_token_expires_at, veto_token_hash")
    .eq("veto_token_hash", hash)
    .limit(1);
  if (error !== null || data === null) return "unknown";
  const [row] = data;
  if (row === undefined || !sameHash(row.veto_token_hash, hash)) return "unknown";
  if (row.veto_token_expires_at === null) return "unknown";
  return new Date(row.veto_token_expires_at).getTime() <= at.getTime() ? "expired" : "unknown";
}

async function readDeadline(draftId: string): Promise<Date | null> {
  const { data, error } = await publishDb()
    .from<{ veto_deadline: string | null }>("drafts")
    .select("veto_deadline")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null || data.veto_deadline === null) return null;
  return new Date(data.veto_deadline);
}
