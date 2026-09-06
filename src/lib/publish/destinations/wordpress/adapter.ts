// BUILD §9 — the WordPress adapter: one create call that publishes live in
// the customer's own site, at most one post per (draft, destination).
//
// §9's WordPress clause reads "REST + application password, posts as draft
// + Yoast/RankMath meta when detected". The owner's ruling of 2026-09-01
// inverted the middle of it — `DECISIONS.md`, ADR-084: "Every CMS publishes
// live in one call" — and left the rest standing. So: REST, an application
// password, the SEO fields when detected, and a page that is publicly
// readable on the customer's own site from the moment the delivery
// completes.
//
// **The two booleans differ here, and this adapter is the reason there are
// two** (ADR-084 Decision 2). `servesPublicly: true` is what puts a live
// address on the publication row, which is what makes the 24-hour check and
// the weekly verdict reach this destination — by rules that already read
// the address and were not edited for it. `hostedByUs: false` is what keeps
// the `removed` unpublish arm hosted-only: without the split, the obvious
// reading of `servesPublicly === true` here is "so we can remove it", and
// unpublish would reach for a delete call against a site ReachKit does not
// own. Merging them fails two assertions in this module's test and nothing
// else in the product.
//
// **One create call, and the two-step is forbidden rather than merely
// unnecessary** (ADR-084 Decision 1). The natural WordPress sequence —
// create a draft, write the plugin fields, publish — opens a window in
// which a post sits in the customer's site as a draft ReachKit meant to
// publish, and a crash inside that window re-creates by accident exactly
// the population the ruling removes; the marker search, which answers "is
// this the post for draft X?", would then have to also answer "and did we
// finish?", the second job ADR-083 Decision 3 forbids loading onto a mark.
// The test asserts a request *count*, not a request *shape*, because a
// second write added later would otherwise read as a harmless follow-up.
//
// **`madeLive: true` and `liveUrl: string` are narrowed by type, and the
// narrowing has inverted.** Until 2026-09-01 this adapter would have
// narrowed them the other way to uphold a promise that a WordPress post is
// never made live by us. That promise is gone. Widening `madeLive` back to
// `boolean` is not a simplification: it is what would let a later edit
// report a delivery as published with nothing live behind it.
//
// **The marker is the second half of the at-most-once guarantee**
// (ADR-080). The unique index on `(draft_id, destination_id)` protects a
// table in our database; it cannot see inside a customer's WordPress. The
// case §9 names — a retry of an attempt whose outcome was never confirmed —
// is precisely the one where we called the destination, it created the
// post, and we lost the answer. The search for the marker is what makes
// that retry find the post instead of making a second one, and it looks for
// the marker and never for the stamp (`marks.ts`).
//
// The archived plans are WO-237, WO-264.
import type {
  DeliveryResult,
  DestinationAdapter,
  DestinationConfig,
  DestinationHealth,
  FailureReason,
  HealthReason,
  RenderedPage,
} from "../../types";
import type { WordPressConfig } from "./client";
import { createPost, createTag, findTag, readRestIndex, readSelf, searchPosts } from "./client";
import { NOT_PUBLISHED, reasonFor, succeeded } from "./errors";
import { bodyWithMarker, carriesMarker, markerToken } from "./marks";
import { detectSeoPlugins, seoMetaFor, seoWrittenIn, type SeoPlugin } from "./seo";
import { unpublishWordPress } from "./unpublish";
import { WORDPRESS } from "@/lib/config/constants";

export type { WordPressConfig } from "./client";
export type { SeoPlugin } from "./seo";

/**
 * What a WordPress delivery is, beyond what every delivery is.
 *
 * `madeLive` and `liveUrl` are narrowed: every post this adapter creates is
 * live at an address the site itself returned. `seoWritten` is possibly
 * empty — REQ-060 criterion 4's case, a delivered page with no SEO plugin
 * to write into — and `stampApplied: false` is a delivered page whose site
 * would not take the term (ADR-083 Decision 4): criterion 6's list is unmet
 * for it, which is stated rather than inferred.
 */
export type WordPressDelivery = DeliveryResult & {
  /** The permalink the create response returned. **Not computed by us and
   *  not derived from the slug**: the site's own answer for the post it
   *  just made live. */
  liveUrl: string;
  madeLive: true;
  /** The WordPress post id. Opaque to us; never rendered. */
  remoteId: string;
  seoWritten: readonly SeoPlugin[];
  stampApplied: boolean;
  deliveredAt: Date;
};

/** A probe that could not ask. **Not an answer**: a transport failure means
 *  ReachKit could not put the question, and reading it as "no" would hold a
 *  working customer's publishing on a network blip while telling them their
 *  account lacks a permission it has. It carries a classified reason and no
 *  part of any payload. */
export class WordPressProbeError extends Error {
  readonly reason: FailureReason;
  constructor(reason: FailureReason) {
    super(`src/lib/publish/destinations/wordpress: the capability probe could not be read.`);
    this.name = "WordPressProbeError";
    this.reason = reason;
  }
}

/** The config, or nothing. A destination whose stored config is not this
 *  shape has a credential that will never work, which is
 *  `credentials_invalid` and not a thing to retry. */
function configOf(cfg: DestinationConfig): WordPressConfig | null {
  const { baseUrl, username, applicationPassword } = cfg as Partial<WordPressConfig>;
  if (typeof baseUrl !== "string" || baseUrl === "") return null;
  if (typeof username !== "string" || username === "") return null;
  if (typeof applicationPassword !== "string" || applicationPassword === "") return null;
  return { baseUrl, username, applicationPassword };
}

function failed(reason: FailureReason): DeliveryResult {
  return { ok: false, madeLive: false, reason };
}

function stringField(post: unknown, field: string): string | null {
  if (typeof post !== "object" || post === null) return null;
  const value = (post as Record<string, unknown>)[field];
  return typeof value === "string" && value !== "" ? value : null;
}

/** The post id, as the id the publication row carries. WordPress answers
 *  with a number; the row holds a string, and the conversion happens once,
 *  here. */
function postId(post: unknown): string | null {
  if (typeof post !== "object" || post === null) return null;
  const id = (post as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return typeof id === "string" && id !== "" ? id : null;
}

/** The raw body, as `context=edit` returns it. The marker lives in the raw
 *  content; the rendered content is the site's own transformation of it and
 *  is not what a confirmation may rest on. */
function rawContent(post: unknown): string {
  if (typeof post !== "object" || post === null) return "";
  const content = (post as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return "";
  const raw = (content as { raw?: unknown }).raw;
  return typeof raw === "string" ? raw : "";
}

function tagIds(post: unknown): readonly number[] {
  if (typeof post !== "object" || post === null) return [];
  const tags = (post as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is number => typeof t === "number");
}

function descriptionOf(page: RenderedPage): string {
  const description = page.meta.description;
  return typeof description === "string" ? description : "";
}

function deliveredAtOf(post: unknown): Date {
  const stamp = stringField(post, "date_gmt") ?? stringField(post, "date");
  const parsed = stamp === null ? Number.NaN : Date.parse(`${stamp}${stamp.endsWith("Z") ? "" : "Z"}`);
  return Number.isNaN(parsed) ? new Date() : new Date(parsed);
}

/**
 * The delivery this post is, whether we have just created it or found it
 * from a previous attempt whose answer we lost.
 *
 * The same reading either way, deliberately: a post found by its marker is
 * the post that attempt created, and describing it differently from a
 * fresh one is how a retried page comes to be recorded with a different
 * address from the one it is live at.
 */
function deliveryOf(
  post: unknown,
  plugins: readonly SeoPlugin[],
  page: { title: string; description: string },
  stampTermId: number | null
): DeliveryResult {
  const liveUrl = stringField(post, "link");
  const id = postId(post);
  if (liveUrl === null || id === null) {
    // An answer with no address and no id is one this module cannot read.
    // It is not retried: an unclassifiable outcome at a destination we do
    // not own must not be hammered three times.
    return failed("destination_rejected");
  }
  if (stringField(post, "status") !== "publish") return failed(NOT_PUBLISHED);

  const delivery: WordPressDelivery = {
    ok: true,
    madeLive: true,
    liveUrl,
    remoteId: id,
    seoWritten: seoWrittenIn(plugins, post, page),
    stampApplied: stampTermId !== null && tagIds(post).includes(stampTermId),
    deliveredAt: deliveredAtOf(post),
  };
  return delivery;
}

/**
 * The post this draft already has in the site, if it has one.
 *
 * The site's own search finds candidates and the marker confirms one
 * exactly, so a search that ranks loosely cannot produce somebody else's
 * post. A search that fails to answer is **not** "no post": it throws the
 * reason, because creating a post on the strength of a failed search is
 * precisely how the second article appears on a paying customer's blog.
 */
async function existingPost(cfg: WordPressConfig, draftId: string): Promise<unknown | null> {
  const answer = await searchPosts(cfg, markerToken(draftId));
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const candidates = Array.isArray(answer.body) ? answer.body : [];
  return candidates.find((post) => carriesMarker(rawContent(post), draftId)) ?? null;
}

/**
 * The stamp's term id, looked up and created if the site does not have it
 * yet.
 *
 * `null` where the credential or the install will not permit the term. That
 * is **not** a failed delivery (ADR-083 Decision 4): the page is still
 * published, `stampApplied: false` records what happened, and REQ-060
 * criterion 6's list is unmet for that post — stated, never inferred.
 */
async function stampTerm(cfg: WordPressConfig): Promise<number | null> {
  const found = await findTag(cfg, WORDPRESS.stampSlug);
  if (succeeded(found) && Array.isArray(found.body)) {
    const id = found.body.map((term) => postId(term)).find((id) => id !== null);
    if (id !== undefined && id !== null) return Number(id);
  }
  const created = await createTag(cfg, WORDPRESS.stampSlug, WORDPRESS.stampName);
  if (!succeeded(created)) return null;
  const id = postId(created.body);
  return id === null ? null : Number(id);
}

async function deliver(
  page: RenderedPage,
  cfg: DestinationConfig,
  idempotencyKey: string
): Promise<DeliveryResult> {
  const config = configOf(cfg);
  if (config === null) return failed("credentials_invalid");

  const seoPage = { title: page.title, description: descriptionOf(page) };

  try {
    // Detection runs before the create so the fields can ride it — the
    // ordering ADR-084 Decision 1 fixes, and the one a create-then-write
    // implementation would invert.
    const plugins = await detectSeoPlugins(config);

    const already = await existingPost(config, idempotencyKey);
    if (already !== null) {
      // The post this draft already has. No second create, whatever the
      // publication row says: the row is the guard in our database and
      // this is the guard in theirs.
      const stampOnIt = tagIds(already);
      return deliveryOf(already, plugins, seoPage, stampOnIt[0] ?? null);
    }

    const stampTermId = await stampTerm(config);
    const meta = seoMetaFor(plugins, seoPage);

    const created = await createPost(config, {
      title: page.title,
      slug: page.slug,
      // ADR-084 Decision 1: the status, the SEO fields, the stamp and the
      // marker, in one request. There is no call in `client.ts` that could
      // raise a draft to `publish`, so no two-step can be composed here.
      status: "publish",
      content: bodyWithMarker(page.bodyMd, idempotencyKey),
      ...(stampTermId === null ? {} : { tags: [stampTermId] }),
      ...(Object.keys(meta).length === 0 ? {} : { meta }),
    });

    if (!succeeded(created)) return failed(reasonFor(created));
    return deliveryOf(created.body, plugins, seoPage, stampTermId);
  } catch (cause) {
    if (cause instanceof WordPressProbeError) return failed(cause.reason);
    // Nothing else this path can throw carries anything a caller may see.
    return failed("destination_rejected");
  }
}

/**
 * What the destination's own end can be seen to be, right now.
 *
 * One authenticated read of the REST index, and **no write to the
 * customer's site**: a health check that proved a capability by creating
 * something could interfere with a delivery in flight, and it runs on the
 * read path, in line, when a customer opens a screen.
 *
 * Whether the credential may *publish* is a different question and is not
 * asked here — `canPublish` below asks it, and the check records what it
 * found on the destination row (ADR-086 Decision 1). Folding it in would
 * make re-entering the same credential appear to clear a state the probe
 * decided.
 */
async function health(
  cfg: DestinationConfig
): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
  const config = configOf(cfg);
  if (config === null) return { health: "error", reason: "credentials_invalid" };

  const answer = await readRestIndex(config);
  if (!answer.ok) return { health: "error", reason: "unreachable" };
  if (answer.status === 401 || answer.status === 403) {
    return { health: "expired", reason: "credentials_expired" };
  }
  if (!succeeded(answer)) return { health: "error", reason: "destination_rejected" };
  // An address that answers 200 with something that is not a REST index is
  // not a WordPress site we can publish to, and saying `ok` would be a
  // claim rather than a reading.
  const namespaces = (answer.body as { namespaces?: unknown }).namespaces;
  if (!Array.isArray(namespaces)) return { health: "error", reason: "destination_rejected" };
  return { health: "ok", reason: null };
}

/**
 * **REQ-060 criterion 7 and ADR-084 Decision 3.** Can this credential
 * *publish*, not merely create?
 *
 * WordPress's default role map gives `edit_posts` to Contributor and
 * `publish_posts` only from Author upward, so an application password from
 * a Contributor-level user can create a post and have WordPress quietly
 * hold it at `draft` whatever the request asked for — the one route by
 * which the ruling of 2026-09-01 could produce, unnoticed, exactly the
 * outcome it abolishes: a page ReachKit reports as published sitting
 * invisible in a drafts folder.
 *
 * **It never creates a post to find out.** One authenticated read of the
 * credential's own account, with the capability map WordPress returns under
 * `context=edit`. A probe that created and deleted a post would leave one
 * behind whenever the delete failed, and would do it on the read path.
 *
 * **`false` is an answer; a failed read is not.** `false` puts the
 * destination in `error`/`cannot_publish`, holds its queue and offers a
 * remedy that costs the customer a WordPress account with the capability.
 * A read that could not be made throws, and the check records nothing —
 * because "we could not ask" is not "the answer is no".
 */
export async function canPublish(cfg: WordPressConfig): Promise<boolean> {
  const answer = await readSelf(cfg);
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const capabilities = (answer.body as { capabilities?: unknown }).capabilities;
  if (typeof capabilities !== "object" || capabilities === null) {
    // An account answer with no capability map is one this probe cannot
    // read. It is not `false`: see the paragraph above.
    throw new WordPressProbeError("destination_rejected");
  }
  return (capabilities as Record<string, unknown>).publish_posts === true;
}

/** The probe as the health check reaches it: config in, answer out, and
 *  the narrowing in one place. */
export function canPublishWith(cfg: DestinationConfig): Promise<boolean> {
  const config = configOf(cfg);
  if (config === null) return Promise.reject(new WordPressProbeError("credentials_invalid"));
  return canPublish(config);
}

export const WORDPRESS_ADAPTER: DestinationAdapter = Object.freeze({
  kind: "wordpress" as const,

  /** The page is publicly readable on the customer's own domain from the
   *  moment the delivery completes, so it carries a live address, is
   *  verified at 24 hours and receives a weekly verdict. */
  servesPublicly: true,

  /** ReachKit does not run this site and cannot take a page off it. This
   *  is what keeps the `removed` arm hosted-only. Never merged back into
   *  `servesPublicly` (ADR-084 Decision 2). */
  hostedByUs: false,

  deliver,

  /** Bound, not implemented here: the four arms and the discriminator live
   *  in `unpublish.ts`, and this file contains no branch on
   *  `made_live_by_us`. */
  unpublish: unpublishWordPress,

  health,

  /** The capability probe, beside `health` and never inside it. */
  canPublish: canPublishWith,
});
