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
    // No row: the token is unknown, already used, or past its expiry. One
    // read by the hash the caller themselves presented says which — see
    // `whyUnusable` for why that answer discloses nothing.
    return { ok: false, reason: await whyUnusable(hash, at) };
  }

  if (row.state !== "in_review") return { ok: false, reason: "not_in_review" };

  const moved = await transition(row.draft_id, "skipped", by, { at, reason: "veto" });
  if (!moved.ok) return { ok: false, reason: "not_in_review" };
  return { ok: true, draftId: row.draft_id };
}

/** Where a stop link points, as a path. The origin belongs to whoever
 *  composes the mail — `/opt-out/{token}` is built the same way
 *  (`src/lib/mail/templates/first-page`), and for the same reason: the one
 *  module that reads `NEXT_PUBLIC_APP_URL` should be the sender, not this
 *  one. Internal name, not a sentence, so it is no copy key.
 *
 *  `src/middleware.ts`'s `PUBLIC_PATHS` carries the pattern this builds
 *  (`/veto/:token`), because a link whose holder has no session is the
 *  whole point of a stop link in a mail. */
export function vetoLinkPath(token: string): string {
  return `/veto/${encodeURIComponent(token)}`;
}

/**
 * Redeems a token presented by a *link*, where nobody is signed in (#144).
 *
 * `redeemVeto` takes the actor from its caller, because the signed-in
 * screen has one. `GET /veto/{token}` has none: the token is the whole of
 * the credential. So the account is read here, from the draft the token is
 * bound to, and the move is recorded against the customer who owns the page
 * rather than against an empty name — `drafts.transitions` says who moved a
 * page, and "" is not who.
 *
 * One read, by the hash the caller presented, before the redemption. It
 * discloses nothing for the same reason `whyUnusable`'s does. A token whose
 * account cannot be read is answered `unknown`: that is a database this
 * function could not read, and a database this function could not read is
 * one `transition()` could not write to either, so the two degrade alike.
 */
export async function redeemVetoLink(token: string, at: Date = new Date()): Promise<RedeemResult> {
  if (token.length === 0) return { ok: false, reason: "unknown" };
  const by = await holderOf(hashToken(token));
  if (by === null) return { ok: false, reason: "unknown" };
  return redeemVeto(token, by, at);
}

/** The account a stop link belongs to: the draft's site's owner. `null`
 *  where no draft carries the hash, or where the row cannot be read. */
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

/**
 * Which of the three an unusable token was.
 *
 * The read is by hash and returns two columns — the expiry and the moment
 * of use — so a caller learns "your link ran out" or "you have already used
 * it" rather than "your link is not a link", and learns nothing about which
 * draft it belonged to or whether one exists.
 *
 * **`used` is not a disclosure** (#144). Reaching this read at all requires
 * presenting the token, and the token is 32 CSPRNG bytes bound to one
 * draft: nobody who does not hold it can ask this question, and the holder
 * is the person the link was mailed to. What it buys is the one arm the
 * public route could not otherwise render — a customer who stopped their
 * page and clicked the link a second time is told they already stopped it,
 * instead of being told their own working link was never a link.
 *
 * Order matters: a token both used and past its expiry is reported `used`,
 * because using it is the thing that happened and expiry is what would have
 * happened had they not.
 */
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

/**
 * What the stop page shows before it stops anything (UI-SPEC S6, issue #371).
 *
 * The screen the set draws **asks** — a card naming the page, the search it
 * targets, the site it goes to and the moment it publishes, over one solid
 * control. So the page needs to read what the token is bound to without
 * spending it, and this is that read: no write, no transition, no token
 * marked used. `redeemVeto` is still the only thing that stops a page.
 *
 * **This is what makes the stop a POST.** Redeeming on arrival — the shape
 * this surface had until #371 — mutates on a GET, which a mail scanner, a
 * link preview or a prefetching client performs without a person: the
 * customer's page was stopped by a robot reading their inbox. Reading here
 * and stopping on submit puts the write behind an act, which is the whole
 * reason the set draws two arms.
 *
 * **It discloses what the set discloses, and no more.** The title, the
 * target search and its monthly volume, the site and the moment — the same
 * facts the `draft-ready` mail already put in that reader's inbox, since
 * the token came from it and that mail's why-block states the volume on a
 * row of its own. Nothing about the account, and nothing about any other
 * page.
 *
 * The refusals are `redeemVeto`'s own, answered from the same two
 * conditions in the same order, so a reader who is told "this link has been
 * used" here would be told the same thing by pressing the control.
 */
export interface VetoPreview {
  readonly draftId: string;
  /** The page's own title, or `null` where the draft carries none yet. */
  readonly title: string | null;
  /** The search the page targets — `null` for a `fix` page, which targets
   *  none (§7's third family). */
  readonly query: string | null;
  /** That search's monthly volume, as §7 measured it when the page was
   *  chosen — the second half of the set's search row (`[search] ·
   *  2,400/mo`). `null` is a volume nobody measured, never a zero: a
   *  measured zero is a result and prints as one. Read, never re-measured. */
  readonly volume: number | null;
  /** The site the page goes live on. */
  readonly domain: string | null;
  /** The page's opening, in the reader's own words rather than ours — the
   *  2026-09-20 board shows it so a reader deciding whether to stop a page
   *  can see what the page actually says. Plain text, first sentence or
   *  two, cut at a word and ellipsed; `null` where the draft has no body
   *  yet, which is a card with no quote rather than an empty one. Read,
   *  never re-rendered: this is a preview, not the page. */
  readonly excerpt: string | null;
  /** When it publishes unless the reader acts, **and the zone that moment
   *  is stated in** — one field, because they are one fact: a time with no
   *  zone beside it is a time the reader has to guess about, and REQ-073 c1
   *  forbids picking a zone on the customer's behalf. `null` where no
   *  moment can be computed — a site with no stated zone, or a page whose
   *  window has already run out. Never substituted. */
  readonly publishes: { readonly at: Date; readonly timeZone: string } | null;
  /** Why the week chose the page (`opportunities.plan_reason`); `null` for a
   *  page chosen before reasons were kept, which states no reason. */
  readonly reason: PlanReason | null;
  /** When the mail carrying this link left (`drafts.told.sentAt`); `null`
   *  where no mail was sent with it. */
  readonly mailedAt: Date | null;
}

/** One day of the stopped page's week: `null` is a day with no page on it. */
export interface WeekDay {
  readonly date: string;
  readonly stopped: boolean | null;
}

/**
 * What a preview answers.
 *
 * **The `used` arm carries the page's title, site and opening, and nothing
 * else does.** The done arm (Round 7 `R7-S5`, #1025) shows the page the
 * reader has just stopped, and a stopped page is exactly a token that now
 * reads as spent. It is no new disclosure: all three reached this reader in
 * the `draft-ready` mail or on the ask arm one click ago, and only the
 * holder of 32 CSPRNG bytes can ask this question at all (`whyUnusable`
 * argues the same point for `used` itself). The other three refusals carry
 * nothing: `unknown` and `expired` name no draft, which is the promise this
 * module opens with.
 */
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

  // The moment, from the one predicate that owns it (REQ-057 c2's rule),
  // never recomputed here. A view that cannot be read leaves the moment
  // null and the card states the rest — a missing date is not a reason to
  // withhold the control that stops the page.
  //
  // The zone is read in the same statement as the domain and travels with
  // the instant, because a site that states none leaves this reader no
  // moment that can be written: `UTC` would be a zone the product picked
  // for them (REQ-073 c1), and the mail this token came from writes the
  // same moment in `sites.timezone` or does not send.
  const view = await machineDraftFor(row.id);
  const answer = view === null ? null : becomesPublishable(view);
  const zone = row.sites?.timezone ?? null;

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
        answer !== null && answer.publishable && zone !== null
          ? { at: answer.at, timeZone: zone }
          : null,
      reason: row.opportunities?.plan_reason ?? null,
      mailedAt: mailedAtOf(row.told),
    },
  };
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

/** How much of the page the card quotes, in characters. Two sentences of
 *  ordinary prose; long enough to show the voice, short enough that the
 *  card stays a decision and not a read. */
const EXCERPT_CHARS = 180;

/**
 * The page's opening as plain text.
 *
 * **Not the Markdown renderer.** This is a quotation, not a rendering:
 * what the card shows is the words, and running the body through the
 * product's one renderer here would put a heading, a list or a link inside
 * a blockquote on a page served to a reader with no session. So the
 * structure is stripped rather than drawn — heading marks, emphasis, list
 * bullets and link syntax reduced to their text — and nothing this
 * function emits is HTML.
 *
 * Cut at a word boundary and ellipsed, so the quote never ends mid-word.
 */
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

/** The page's own title, or `null` where the draft carries none yet — an
 *  empty string is not a title, and a card that drew one would draw an
 *  empty heading. */
function titleOf(row: PreviewRow): string | null {
  return row.title === null || row.title === "" ? null : row.title;
}
