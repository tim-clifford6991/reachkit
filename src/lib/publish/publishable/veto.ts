// BUILD §9 — the veto link: one hashed, single-use, draft-bound token that expires at the veto deadline and performs
// exactly one transition, REQ-057 c1's "single action to stop it"; a second use stops nothing further.
// The token: 32 CSPRNG bytes for a URL, stored only as its SHA-256 hash, bound to one draft until its `veto_deadline`,
// and marked used in the same statement that reads it (`redeem_veto_token`), so a double click cannot skip twice.
// No token at a zero window (REQ-057 c7); the customer is offered a take-down instead, which is `unpublish()`'s.
// Refusals disclose nothing: `unknown` and `expired` name no draft, and `not_in_review` lets the surface offer the take-down.
// No log line here carries a token or its hash.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { VETO_TOKEN_BYTES, WEEK_START } from "@/lib/config/constants";
import type { PlanReason } from "@/lib/opportunities/types";
import { publishDb } from "../db";
import { machineDraftFor, transition } from "../machine";
import { becomesPublishable } from "./predicate";
import type { Actor, State, ToldRecord, VetoLink } from "../types";

export type VetoRefusal = "unknown" | "expired" | "used" | "not_in_review";

export type RedeemResult =
  | { ok: true; draftId: string }
  | { ok: false; reason: VetoRefusal };

/** The hex hash in `drafts.veto_token_hash`, so the database compares hashes, never tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison, used wherever both hashes are in hand, since the database's equality filter is not. */
export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Issues the stop link. At a zero window nothing is written and `{ token: '', expiresAt: null }` returns: not a failure,
 *  since a link would be an offer REQ-057 c7 says cannot be kept. */
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

/** Redeems a token: marks it used and takes `in_review → skipped` through `transition()`, never a direct write, so the
 *  veto is one of §9's edges, recorded like every move. */
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
    // Unknown, used or expired: one read by the presented hash says which, disclosing nothing (`whyUnusable`).
    return { ok: false, reason: await whyUnusable(hash, at) };
  }

  if (row.state !== "in_review") return { ok: false, reason: "not_in_review" };

  const moved = await transition(row.draft_id, "skipped", by, { at, reason: "veto" });
  if (!moved.ok) return { ok: false, reason: "not_in_review" };
  return { ok: true, draftId: row.draft_id };
}

/** A stop link's path; the mail's composer adds the origin, as for `/opt-out/{token}`. `PUBLIC_PATHS` carries
 *  `/veto/:token`, since its holder has no session. */
export function vetoLinkPath(token: string): string {
  return `/veto/${encodeURIComponent(token)}`;
}

/** Redeems a token from a link, with nobody signed in: the actor is the page's owner, read by the presented hash, so
 *  `drafts.transitions` names who moved it. An unreadable account is `unknown`, as `transition()` could not write either. */
export async function redeemVetoLink(token: string, at: Date = new Date()): Promise<RedeemResult> {
  if (token.length === 0) return { ok: false, reason: "unknown" };
  const by = await holderOf(hashToken(token));
  if (by === null) return { ok: false, reason: "unknown" };
  return redeemVeto(token, by, at);
}

/** The draft's site's owner, or `null` where no draft carries the hash or it cannot be read. */
async function holderOf(hash: string): Promise<Actor | null> {
  const { data, error } = await publishDb()
    .from<{ sites: { user_id: string } | null }>("drafts")
    .select("sites(user_id)")
    .eq("veto_token_hash", hash)
    .limit(1);
  if (error !== null || data === null) return null;
  const userId = data[0]?.sites?.user_id;
  if (typeof userId !== "string" || userId.length === 0) return null;
  return { kind: "customer", userId };
}

/** Which of the three an unusable token was, by hash, naming no draft. `used` is no disclosure: only the link's holder
 *  can ask, and they learn they already stopped the page. Used and expired reports `used`, which is what happened. */
async function whyUnusable(hash: string, at: Date): Promise<"unknown" | "expired" | "used"> {
  const { data, error } = await publishDb()
    .from<{
      veto_token_expires_at: string | null;
      veto_token_used_at: string | null;
      veto_token_hash: string;
    }>("drafts")
    .select("veto_token_expires_at, veto_token_used_at, veto_token_hash")
    .eq("veto_token_hash", hash)
    .limit(1);
  if (error !== null || data === null) return "unknown";
  const [row] = data;
  if (row === undefined || !sameHash(row.veto_token_hash, hash)) return "unknown";
  if (row.veto_token_used_at !== null) return "used";
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

/** What the stop page shows before it stops anything (UI-SPEC S6): a read with no write, transition or spent token;
 *  `redeemVeto` alone stops a page. The stop is a POST, since a GET is followed by mail scanners and link previews.
 *  It discloses only what the `draft-ready` mail already did, and refuses as `redeemVeto` would, in the same order. */
export interface VetoPreview {
  readonly draftId: string;
  /** The page's own title, or `null` where the draft carries none yet. */
  readonly title: string | null;
  /** The search the page targets; `null` for a `fix` page (§7's third family). */
  readonly query: string | null;
  /** That search's monthly volume as measured when chosen (`[search] · 2,400/mo`); `null` is unmeasured, never zero. */
  readonly volume: number | null;
  /** The site the page goes live on. */
  readonly domain: string | null;
  /** The page's opening as plain text, cut at a word and ellipsed, so a reader sees what it says; `null` with no body. */
  readonly excerpt: string | null;
  /** When it publishes unless the reader acts, with its zone as one fact (REQ-073 c1 forbids picking one). `null` with
   *  no moment or while held (address unconnected, ReachKit stopped, publishing off, destination down); never substituted. */
  readonly publishes: { readonly at: Date; readonly timeZone: string } | null;
  /** The hosted address waits for its record, so no moment can be promised. */
  readonly unconnected: boolean;
  /** Why the week chose the page (`opportunities.plan_reason`); `null` states no reason. */
  readonly reason: PlanReason | null;
  /** When the mail carrying this link left (`drafts.told.sentAt`), or `null`. */
  readonly mailedAt: Date | null;
}

/** One day of the stopped page's week: `null` is a day with no page on it. */
export interface WeekDay {
  readonly date: string;
  readonly stopped: boolean | null;
}

/** What a preview answers. Only `used` carries the title, site and opening, for the done arm showing the page just
 *  stopped: no new disclosure, as the holder already saw them. The other refusals carry nothing. */
export type PreviewResult =
  | { ok: true; preview: VetoPreview }
  | {
      ok: false;
      reason: "used";
      title: string | null;
      domain: string | null;
      excerpt: string | null;
      /** Mon–Sun around the stopped page's day; `null` where it cannot be read. */
      week: readonly WeekDay[] | null;
    }
  | { ok: false; reason: Exclude<VetoRefusal, "used"> };

interface PreviewRow {
  id: string;
  site_id: string;
  state: string;
  scheduled_for: string | null;
  told: ToldRecord | null;
  title: string | null;
  veto_token_used_at: string | null;
  veto_token_expires_at: string | null;
  body_md: string | null;
  opportunities?: { target_query?: string | null; volume?: number | null; plan_reason?: PlanReason | null } | null;
  sites?: { domain?: string | null; timezone?: string | null } | null;
}

export async function previewVetoLink(
  token: string,
  at: Date = new Date()
): Promise<PreviewResult> {
  if (token.length === 0) return { ok: false, reason: "unknown" };

  const { data, error } = await publishDb()
    .from<PreviewRow>("drafts")
    .select(
      "id, site_id, state, scheduled_for, told, title, body_md, veto_token_used_at, veto_token_expires_at, opportunities(target_query, volume, plan_reason), sites(domain, timezone)"
    )
    .eq("veto_token_hash", hashToken(token))
    .limit(1);
  if (error !== null) return { ok: false, reason: "unknown" };

  const row = data?.[0];
  if (row === undefined) return { ok: false, reason: "unknown" };
  if (row.veto_token_used_at !== null) {
    return {
      ok: false,
      reason: "used",
      title: titleOf(row),
      domain: row.sites?.domain ?? null,
      excerpt: excerptOf(row.body_md),
      week: row.scheduled_for === null ? null : await weekOf(row.site_id, row.scheduled_for),
    };
  }
  if (
    row.veto_token_expires_at !== null &&
    new Date(row.veto_token_expires_at).getTime() <= at.getTime()
  ) {
    return { ok: false, reason: "expired" };
  }
  if (row.state !== "in_review") return { ok: false, reason: "not_in_review" };

  // The moment from REQ-057 c2's predicate, never recomputed; unreadable, the card still offers the stop. The zone
  // travels with it, as `UTC` would be a zone we picked (REQ-073 c1).
  const view = await machineDraftFor(row.id);
  const answer = view === null ? null : becomesPublishable(view);
  const zone = row.sites?.timezone ?? null;
  const [unconnected, held] = await Promise.all([addressUnconnected(row.site_id), heldNow(row.site_id, at)]);

  return {
    ok: true,
    preview: {
      draftId: row.id,
      title: titleOf(row),
      query: row.opportunities?.target_query ?? null,
      volume: row.opportunities?.volume ?? null,
      domain: row.sites?.domain ?? null,
      excerpt: excerptOf(row.body_md),
      publishes:
        answer !== null && answer.publishable && zone !== null && !unconnected && !held
          ? { at: answer.at, timeZone: zone }
          : null,
      unconnected,
      reason: row.opportunities?.plan_reason ?? null,
      mailedAt: mailedAtOf(row.told),
    },
  };
}

/** Whether the hosted address is attached but not live, as the draft-ready mail reads it; a failed read claims nothing. */
async function addressUnconnected(siteId: string): Promise<boolean> {
  try {
    const { hostedHostFor } = await import("../destinations/hosted/hostname");
    const host = await hostedHostFor(siteId);
    return host !== null && host.state !== "live";
  } catch {
    return false;
  }
}

/** Whether the page would not go live at its moment: ReachKit's kill switch
 *  or day ceiling, the site's publishing switch, or a destination that is
 *  not working. A read that fails is held, since no hour can be promised on it. */
async function heldNow(siteId: string, at: Date): Promise<boolean> {
  try {
    const [{ isPublishingOn, reachKitStopped }, { destinationWorking }, daily] = await Promise.all([
      import("../switch"),
      import("../destinations"),
      import("@/lib/costs/daily"),
    ]);
    const [stopped, on, working, spent, ceiling] = await Promise.all([
      reachKitStopped(),
      isPublishingOn(siteId),
      destinationWorking(siteId),
      daily.readDaySpendCents(at),
      daily.readDayCeilingCents(at),
    ]);
    return stopped || !on || !working || spent === null || daily.ceilingReached(spent, ceiling);
  } catch {
    return true;
  }
}

/** The told record's send time, where a mail left with it and the time reads. */
function mailedAtOf(told: ToldRecord | null): Date | null {
  if (told === null || told.mailed === false) return null;
  const at = new Date(told.sentAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_MS = 86_400_000;

/** A stopped page's week as Plan holds it: a day with a written page says
 *  whether it was stopped, a day still planned goes ahead, and a day whose
 *  planned page was stopped before writing claims nothing, since a spare may take it. */
async function weekOf(siteId: string, day: string): Promise<readonly WeekDay[] | null> {
  const at = Date.parse(`${day}T00:00:00Z`);
  const back = (new Date(at).getUTCDay() - WEEKDAYS.indexOf(WEEK_START) + 7) % 7;
  const dates = Array.from({ length: 7 }, (_, i) => new Date(at + (i - back) * DAY_MS).toISOString().slice(0, 10));
  const [drafts, planned] = await Promise.all([
    publishDb()
      .from<{ scheduled_for: string; state: State }>("drafts")
      .select("scheduled_for, state")
      .eq("site_id", siteId)
      .gte("scheduled_for", dates[0]!)
      .lte("scheduled_for", dates[6]!),
    publishDb()
      .from<{ planned_for: string }>("opportunities")
      .select("planned_for")
      .eq("site_id", siteId)
      .eq("status", "open")
      .gte("planned_for", dates[0]!)
      .lte("planned_for", dates[6]!),
  ]);
  if (drafts.error !== null || drafts.data === null || planned.error !== null || planned.data === null) return null;
  const written = drafts.data;
  const open = new Set(planned.data.map((row) => row.planned_for));
  return dates.map((date): WeekDay => {
    const onDay = written.filter((row) => row.scheduled_for === date);
    if (onDay.length > 0) return { date, stopped: onDay.every((row) => row.state === "skipped" || row.state === "unpublished") };
    return { date, stopped: open.has(date) ? false : null };
  });
}

/** About two sentences: enough to show the voice, short enough that the card stays a decision. */
const EXCERPT_CHARS = 180;

/** The opening as plain text: a quotation, not the renderer, so structure is stripped to its words and nothing is HTML.
 *  Cut at a word and ellipsed. */
function excerptOf(body: string | null): string | null {
  if (body === null) return null;
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return null;
  if (text.length <= EXCERPT_CHARS) return text;
  const cut = text.slice(0, EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The page's title, or `null`: an empty string would draw an empty heading. */
function titleOf(row: PreviewRow): string | null {
  return row.title === null || row.title === "" ? null : row.title;
}
