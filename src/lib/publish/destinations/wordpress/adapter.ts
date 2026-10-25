// BUILD §9 — the WordPress adapter: REST, an application password, the SEO fields when detected, and one create call
// that publishes live in the customer's own site (ADR-084: "Every CMS publishes live in one call"), at most one post per
// (draft, destination).
// The two booleans differ here (ADR-084 decision 2): `servesPublicly: true` gives the row a live address, so the 24-hour
// check and the weekly verdict reach it; `hostedByUs: false` keeps the `removed` arm hosted-only, never a delete call
// against a site we do not own.
// One create call; the two-step (draft, fields, publish) is forbidden (ADR-084 decision 1), since a crash inside it
// leaves a draft we meant to publish and would load "did we finish?" onto the marker (ADR-083 decision 3). The test
// counts requests, so a later second write fails it.
// `madeLive: true` and `liveUrl: string` are narrowed by type; widening `madeLive` would let a delivery report published
// with nothing live.
// The marker is the second half of at-most-once (ADR-080): the unique index cannot see inside the customer's site, so a
// retry whose answer was lost finds the post by marker, never by stamp (`marks.ts`).
// The stamp is asked about before it is written (ADR-083 decision 4): `canStamp` gates the one term we would create.
// It is not a health input: a site that publishes and refuses the term is working.
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
import {
  createPost,
  createTag,
  findPostBySlug,
  findTag,
  readRestIndex,
  readSelf,
  searchPosts,
  updatePost,
} from "./client";
import { NOT_PUBLISHED, reasonFor, succeeded } from "./errors";
import { bylineHtml } from "../../render/byline";
import { madeHtml } from "../../render/made";
import { copyIn } from "@/lib/presentation/copy/translated";
import { readFaq, withFaq } from "../../render/faq";
import { parseMarkdown, toHtml, type Say } from "../../render/markdown";
import { bodyWithMarker, carriesMarker, markerToken } from "./marks";
import { detectSeoPlugins, seoMetaFor, seoWrittenIn, type SeoPlugin } from "./seo";
import { unpublishWordPress } from "./unpublish";
import { WORDPRESS } from "@/lib/config/constants";

export type { WordPressConfig } from "./client";
export type { SeoPlugin } from "./seo";

/** A WordPress delivery: live at an address the site returned. `seoWritten` may be empty (REQ-060 c4), and
 *  `stampApplied: false` states that c6's list is unmet for the post (ADR-083 decision 4). */
export type WordPressDelivery = DeliveryResult & {
  /** The permalink the site returned, never computed from the slug. */
  liveUrl: string;
  madeLive: true;
  /** The WordPress post id. Opaque to us; never rendered. */
  remoteId: string;
  seoWritten: readonly SeoPlugin[];
  stampApplied: boolean;
  deliveredAt: Date;
};

/** A probe that could not ask, which is not "no": a blip must not hold a working customer's publishing. A classified
 *  reason, no payload. */
export class WordPressProbeError extends Error {
  readonly reason: FailureReason;
  constructor(reason: FailureReason) {
    super(`src/lib/publish/destinations/wordpress: the capability probe could not be read.`);
    this.name = "WordPressProbeError";
    this.reason = reason;
  }
}

/** The config, or nothing: another shape will never work, `credentials_invalid`, not retried. */
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

/** A post's or term's id as the string the row holds; WordPress answers a number. */
function idOf(thing: unknown): string | null {
  if (typeof thing !== "object" || thing === null) return null;
  const id = (thing as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return typeof id === "string" && id !== "" ? id : null;
}

/** The raw body under `context=edit`, where the marker lives; the rendered content is the site's, not ours to confirm on. */
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

/** The post's content (SPEC §7): the byline and dates as the first paragraph (UTC, as the adapter holds no zone), the
 *  made-with note in the site's language, then the body through the one renderer with `withFaq`'s questions. */
function contentOf(page: RenderedPage, dates: { published: Date; updated: Date | null }): string {
  const site = page.site;
  const say: Say | undefined = site === undefined ? undefined : (key, vars) => copyIn(site.language, key, vars);
  const made = site === undefined ? "" : madeHtml({ meta: page.meta, domain: site.domain, bodyMd: page.bodyMd, ...(say === undefined ? {} : { say }) });
  return bylineHtml({ byline: page.byline ?? null, ...dates, timeZone: null }) + made + toHtml(withFaq(parseMarkdown(page.bodyMd), readFaq(page.meta), say).blocks);
}

function deliveredAtOf(post: unknown): Date {
  const stamp = stringField(post, "date_gmt") ?? stringField(post, "date");
  const parsed = stamp === null ? Number.NaN : Date.parse(`${stamp}${stamp.endsWith("Z") ? "" : "Z"}`);
  return Number.isNaN(parsed) ? new Date() : new Date(parsed);
}

/** The delivery a post is, created now or found from a lost attempt, read the same way so a retry records the live address. */
function deliveryOf(
  post: unknown,
  plugins: readonly SeoPlugin[],
  page: { title: string; description: string },
  stampTermId: number | null
): DeliveryResult {
  const liveUrl = stringField(post, "link");
  const id = idOf(post);
  if (liveUrl === null || id === null) {
    // Unreadable, and not retried: a site we do not own is not hammered three times.
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

/** The same page when only scheme, `www.` or a trailing slash differ; a query string is identity and stays. */
function sameAddress(a: string, b: string): boolean {
  const strip = (url: string): string =>
    url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/#.*$/, "")
      .replace(/\/+$/, "");
  return strip(a) === strip(b);
}

/** An update's delivery: `madeLive: false`, so `unpublish` never returns the customer's own page to draft. No stamp,
 *  which only a post we create gets (ADR-083 decision 2). */
function updateDeliveryOf(
  post: unknown,
  plugins: readonly SeoPlugin[],
  page: { title: string; description: string }
): DeliveryResult {
  const liveUrl = stringField(post, "link");
  const id = idOf(post);
  if (liveUrl === null || id === null) return failed("destination_rejected");
  if (stringField(post, "status") !== "publish") return failed(NOT_PUBLISHED);
  return {
    ok: true,
    madeLive: false,
    liveUrl,
    remoteId: id,
    seoWritten: seoWrittenIn(plugins, post, page),
  };
}

/** §7's third asset kind, rewritten where it stands; not found there, it is refused, never created as a second page. */
async function updated(
  cfg: WordPressConfig,
  page: RenderedPage,
  updateOf: string,
  plugins: readonly SeoPlugin[],
  seoPage: { title: string; description: string },
  idempotencyKey: string
): Promise<DeliveryResult> {
  // Already rewritten, by its marker: no second write.
  const already = await existingPost(cfg, idempotencyKey);
  if (already !== null) return updateDeliveryOf(already, plugins, seoPage);

  if (page.slug.trim() === "") return failed("destination_rejected");

  const answer = await findPostBySlug(cfg, page.slug);
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const candidates = Array.isArray(answer.body) ? answer.body : [];
  const target = candidates.find((post) => {
    const link = stringField(post, "link");
    return link !== null && sameAddress(link, updateOf);
  });
  const id = target === undefined ? null : idOf(target);
  if (id === null) return failed("destination_rejected");

  const meta = seoMetaFor(plugins, seoPage);
  // The marker rides the body, so a retry finds this page and writes nothing twice.
  const written = await updatePost(cfg, id, {
    title: page.title,
    // Their page keeps its own date; today is its update.
    content: bodyWithMarker(contentOf(page, { published: deliveredAtOf(target), updated: new Date() }), idempotencyKey),
    ...(Object.keys(meta).length === 0 ? {} : { meta }),
  });
  if (!succeeded(written)) return failed(reasonFor(written));
  return updateDeliveryOf(written.body, plugins, seoPage);
}

/** SPEC §9: only the title and/or SEO description change, and the content is never sent. Found by slug, confirmed by
 *  address. A description with no plugin is refused, as WordPress has no such field. Idempotent without a marker. */
async function metadataUpdated(
  cfg: WordPressConfig,
  page: RenderedPage,
  updateOf: string,
  fix: { title: string | null; description: string | null },
  plugins: readonly SeoPlugin[]
): Promise<DeliveryResult> {
  if (page.slug.trim() === "") return failed("destination_rejected");
  if (fix.description !== null && plugins.length === 0) return failed("destination_rejected");

  const answer = await findPostBySlug(cfg, page.slug);
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const candidates = Array.isArray(answer.body) ? answer.body : [];
  const target = candidates.find((post) => {
    const link = stringField(post, "link");
    return link !== null && sameAddress(link, updateOf);
  });
  const id = target === undefined ? null : idOf(target);
  if (id === null) return failed("destination_rejected");

  const currentTitle = stringField(target, "title") ?? page.title;
  const seoPage = { title: fix.title ?? currentTitle, description: fix.description ?? "" };
  const meta = seoMetaFor(plugins, seoPage);
  const written = await updatePost(cfg, id, {
    ...(fix.title === null ? {} : { title: fix.title }),
    ...(Object.keys(meta).length === 0 ? {} : { meta }),
  });
  if (!succeeded(written)) return failed(reasonFor(written));
  return updateDeliveryOf(written.body, plugins, seoPage);
}

/** The post this draft already has: the search finds candidates and the marker confirms one exactly. A failed search
 *  throws, never "no post", which is how a second article would appear. */
async function existingPost(cfg: WordPressConfig, draftId: string): Promise<unknown | null> {
  const answer = await searchPosts(cfg, markerToken(draftId));
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const candidates = Array.isArray(answer.body) ? answer.body : [];
  return candidates.find((post) => carriesMarker(rawContent(post), draftId)) ?? null;
}

/** The stamp's term id, created if missing; `null` where not permitted, never a failed delivery (ADR-083 decision 4). */
async function stampTerm(cfg: WordPressConfig): Promise<number | null> {
  const found = await findStampTerm(cfg);
  if (found !== null) return found;
  // Creating it writes into the customer's site, so ask first; the lookup comes first so a later delivery costs no read.
  if (!(await mayStamp(cfg))) return null;
  const created = await createTag(cfg, WORDPRESS.stampSlug, WORDPRESS.stampName);
  if (!succeeded(created)) return null;
  const id = idOf(created.body);
  return id === null ? null : Number(id);
}

/** The stamp probe on the delivery path, never failing a delivery. Unreadable is `false` here only, since "could not
 *  ask" is no permission to write; the row's fact is `checkHealth`'s, untouched. */
async function mayStamp(cfg: WordPressConfig): Promise<boolean> {
  try {
    return await canStamp(cfg);
  } catch {
    return false;
  }
}

/** The stamp's term id if the site has it, else `null`; a lookup, never a create, for the idempotent path. */
async function findStampTerm(cfg: WordPressConfig): Promise<number | null> {
  const found = await findTag(cfg, WORDPRESS.stampSlug);
  if (!succeeded(found) || !Array.isArray(found.body)) return null;
  const id = found.body.map((term) => idOf(term)).find((value) => value !== null);
  return id === undefined || id === null ? null : Number(id);
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
    // Detection before the create, so the fields ride it (ADR-084 decision 1).
    const plugins = await detectSeoPlugins(config);

    // §7's update first, with its own marker check, so a page we did not create is never recorded as made live.
    if (page.updateOf !== undefined && page.metadataOnly !== undefined) {
      return await metadataUpdated(config, page, page.updateOf, page.metadataOnly, plugins);
    }
    if (page.updateOf !== undefined) {
      return await updated(config, page, page.updateOf, plugins, seoPage, idempotencyKey);
    }

    const already = await existingPost(config, idempotencyKey);
    if (already !== null) {
      // No second create: the row guards our database and this guards theirs. The stamp is looked up, never created
      // here (ADR-083 decision 2).
      return deliveryOf(already, plugins, seoPage, await findStampTerm(config));
    }

    const stampTermId = await stampTerm(config);
    const meta = seoMetaFor(plugins, seoPage);

    const created = await createPost(config, {
      title: page.title,
      slug: page.slug,
      // ADR-084 decision 1: status, SEO fields, stamp and marker in one request; `client.ts` cannot compose a two-step.
      status: "publish",
      // The one place a body becomes HTML, through the renderer every preview shares, so the site gets what the customer saw.
      content: bodyWithMarker(contentOf(page, { published: new Date(), updated: null }), idempotencyKey),
      ...(stampTermId === null ? {} : { tags: [stampTermId] }),
      ...(Object.keys(meta).length === 0 ? {} : { meta }),
    });

    if (!succeeded(created)) return failed(reasonFor(created));
    return deliveryOf(created.body, plugins, seoPage, stampTermId);
  } catch (cause) {
    if (cause instanceof WordPressProbeError) return failed(cause.reason);
    // Nothing else thrown here carries anything a caller may see.
    return failed("destination_rejected");
  }
}

/** One authenticated read of the REST index, never a write, as it runs in line on the read path. Publishing is
 *  `canPublish`'s question (ADR-086 decision 1), never folded in. */
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
  // A 200 that is not a REST index is not a WordPress site we can publish to.
  const namespaces = (answer.body as { namespaces?: unknown }).namespaces;
  if (!Array.isArray(namespaces)) return { health: "error", reason: "destination_rejected" };
  return { health: "ok", reason: null };
}

/** REQ-060 c7, ADR-084 decision 3: can this credential publish, not merely create? A Contributor can create a post
 *  WordPress quietly holds at `draft`. One read of the account's `context=edit` capability map, never a test post.
 *  `false` is an answer (`cannot_publish`, queue held); a failed read throws and records nothing. */
export async function canPublish(cfg: WordPressConfig): Promise<boolean> {
  const answer = await readSelf(cfg);
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const capabilities = (answer.body as { capabilities?: unknown }).capabilities;
  if (typeof capabilities !== "object" || capabilities === null) {
    // No capability map is unreadable, not `false`.
    throw new WordPressProbeError("destination_rejected");
  }
  return (capabilities as Record<string, unknown>).publish_posts === true;
}

/** The probe as the health check reaches it. */
export function canPublishWith(cfg: DestinationConfig): Promise<boolean> {
  const config = configOf(cfg);
  if (config === null) return Promise.reject(new WordPressProbeError("credentials_invalid"));
  return canPublish(config);
}

/** ADR-083 decision 4, REQ-060 c6: can this site carry the findability stamp? Its own capability, `manage_categories`
 *  (Editor), apart from `publish_posts` (Author). The two probes deliberately share no implementation (BP-048 decision
 *  4), as a capability set invites gating one on the other. One read of the same capability map, never a test term.
 *  Conservative by one case: a site that has the term reads `false`, harmlessly, since delivery looks the term up first
 *  and `stampApplied` is read back per post. `false` is an answer; a failed read is not. */
export async function canStamp(cfg: WordPressConfig): Promise<boolean> {
  const answer = await readSelf(cfg);
  if (!succeeded(answer)) throw new WordPressProbeError(reasonFor(answer));
  const capabilities = (answer.body as { capabilities?: unknown }).capabilities;
  if (typeof capabilities !== "object" || capabilities === null) {
    // No capability map is unreadable, not `false`, which would deny a list nothing had asked about.
    throw new WordPressProbeError("destination_rejected");
  }
  return (capabilities as Record<string, unknown>).manage_categories === true;
}

/** The stamp probe as the health check reaches it. */
export function canStampWith(cfg: DestinationConfig): Promise<boolean> {
  const config = configOf(cfg);
  if (config === null) return Promise.reject(new WordPressProbeError("credentials_invalid"));
  return canStamp(config);
}

export const WORDPRESS_ADAPTER: DestinationAdapter = Object.freeze({
  kind: "wordpress" as const,

  /** Publicly readable on the customer's domain once delivered: a live address, the 24-hour check, a weekly verdict. */
  servesPublicly: true,

  /** We do not run this site, which keeps `removed` hosted-only; never merged with `servesPublicly` (ADR-084 decision 2). */
  hostedByUs: false,

  deliver,

  /** The four arms and the discriminator live in `unpublish.ts`; nothing here branches on `made_live_by_us`. */
  unpublish: unpublishWordPress,

  health,

  /** The capability probe, beside `health` and never inside it. */
  canPublish: canPublishWith,

  /** The stamp probe, never merged with the publish probe; only that one is a health input. */
  canStamp: canStampWith,
});
