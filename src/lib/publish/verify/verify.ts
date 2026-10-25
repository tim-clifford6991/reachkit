// BUILD §9 — "**Verification:** publish +24h → fetch the live URL, confirm
// reachable/indexable/in-sitemap/AI-readable".
//
// One fetch of the page's own address, once ever, recording exactly one of REQ-062 c4's three outcomes.
// The four checks come from the `found` arm only: the other two state no failure, name no cause and make no further fetch.
// `could_not_confirm` is never folded into `reachable: false` (ADR-085): our network problem is not an accusation against
// the customer's page; `tests/publish/verify/verify.test.ts`'s arm-separation rows hold it.
// `reachable` is always `true` under `found` and kept: REQ-062 c1–3 promise four outcomes with dates, so deleting it is a
// surface change, not a cleanup.
// The user agent is our own token, never one of the pinned AI readers we would be impersonating. Nothing here retries.
import { AI_READER_AGENTS, VERIFY } from "@/lib/config/constants";
import { readRobots, safeFetch } from "@/lib/egress";
import type { RobotsPolicy } from "@/lib/egress/types";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { parseOnPage } from "@/lib/measure/parse";
import { publishDb } from "../db";
import { hostedAddressNow } from "../destinations/hosted";
import type { SiteCondition, VerifyChecks, VerifyOutcome } from "../types";
import { classify } from "./answer";
import { bodyCoverage } from "./coverage";
import { dispositionOf, DISPOSITION_COLUMNS, PublicationNotFound, type DispositionRow } from "./due";
import { conditionFrom, type RobotsReading, type SitemapReading } from "./site";
import { toStoredCheck } from "./stored";

/** Declared in `types.ts`, since declaring them here would close `record/ → verify/ → types.ts` into a cycle (ADR-092). */
export type { NotConfirmed, VerifyChecks, VerifyDisposition, VerifyOutcome } from "../types";

/** Declared in the database-free `checks.ts` for the mail template, re-exported beside the code that produces them. */
export { CHECK_IDS, type CheckId } from "./checks";

/** What one run did; recording nothing, it names the disposition that held, never a fabricated outcome. */
export type VerifyRun =
  | { recorded: true; result: VerifyOutcome; siteCondition: SiteCondition | null }
  | { recorded: false; because: "not_yet" | "done" | "never" };

interface VerifyRow extends DispositionRow {
  site_id: string;
  draft_id: string;
  destination: string;
}

interface DraftRow {
  title: string;
  body_md: string | null;
}

const TIMEOUT_MS = 10_000;

/** Where a sitemap lives when robots names none: the conventional addresses, read here and written nowhere. */
const CONVENTIONAL_SITEMAPS = ["/sitemap_index.xml", "/sitemap.xml"] as const;

async function readPublication(publicationId: string): Promise<VerifyRow> {
  const { data, error } = await publishDb()
    .from<VerifyRow>("publications")
    .select(`${DISPOSITION_COLUMNS}, site_id, draft_id, destination`)
    .eq("id", publicationId)
    .limit(1);
  if (error !== null) throw new Error(`verifyLive(${publicationId}): ${error.message}`);
  const row = data?.[0];
  if (row === undefined) throw new PublicationNotFound(publicationId);
  return row;
}

async function readDraft(draftId: string): Promise<DraftRow | null> {
  const { data, error } = await publishDb()
    .from<DraftRow>("drafts")
    .select("title, body_md")
    .eq("id", draftId)
    .limit(1);
  if (error !== null) throw new Error(`verifyLive: could not read draft ${draftId}: ${error.message}`);
  return data?.[0] ?? null;
}

// ── The three checks that are not `reachable` ───────────────────────────

/** REQ-062 c1's "is not marked against indexing", from the `X-Robots-Tag` header and the document, as either alone can be set. */
function indexableFrom(a: {
  headers: Readonly<Record<string, string>>;
  html: string;
  url: string;
  at: Date;
}): Measured<boolean> {
  const header = a.headers["x-robots-tag"] ?? "";
  const headerMarks = /\b(noindex|none)\b/i.test(header);
  const documentMarks = parseOnPage({ url: a.url, html: a.html }).noindex;
  return measured(!headerMarks && !documentMarks, a.at);
}

function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => (m[1] ?? "").trim());
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex\b/i.test(xml);
}

function sameAddress(a: string, b: string): boolean {
  const normalise = (value: string): string | null => {
    try {
      const url = new URL(value);
      return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
    } catch {
      return null;
    }
  };
  const left = normalise(a);
  const right = normalise(b);
  return left !== null && right !== null && left === right;
}

/** Reads the site's sitemap, following an index up to `VERIFY.sitemapMaxDocuments`. Criterion 6 turns on the three
 *  readings: an answered "no sitemap" is a condition; no answer or an unreadable one costs this page's check alone. */
async function readSitemap(a: {
  origin: string;
  robots: RobotsPolicy | null;
}): Promise<SitemapReading> {
  const declared = a.robots?.sitemaps ?? [];
  const queue: string[] = [
    ...declared,
    ...CONVENTIONAL_SITEMAPS.map((path) => new URL(path, a.origin).toString()),
  ];

  const seen = new Set<string>();
  const urls: string[] = [];
  let read = 0;
  let answeredWithADocument = false;
  let sawNonAnswer = false;
  let sawAbsent = false;

  while (queue.length > 0 && read < VERIFY.sitemapMaxDocuments) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    read += 1;

    const outcome = await safeFetch(next, {
      timeoutMs: TIMEOUT_MS,
      userAgent: "reachkit-verify",
    });
    if (!outcome.ok) {
      sawNonAnswer = true;
      continue;
    }
    if (outcome.status === 404 || outcome.status === 410) {
      // An answer: nothing there.
      sawAbsent = true;
      continue;
    }
    if (outcome.status < 200 || outcome.status >= 300) {
      sawNonAnswer = true;
      continue;
    }
    const found = locations(outcome.html);
    if (found.length === 0 && !isSitemapIndex(outcome.html)) {
      // A 200 that is not a sitemap: read, and unreadable as one.
      sawNonAnswer = true;
      continue;
    }
    answeredWithADocument = true;
    if (isSitemapIndex(outcome.html)) queue.push(...found);
    else urls.push(...found);
  }

  if (answeredWithADocument) return { kind: "listed", urls };
  if (sawNonAnswer) return { kind: "no_answer" };
  // Every address answered that nothing is there: the site publishes no sitemap.
  return sawAbsent && declared.length === 0 ? { kind: "none" } : { kind: "no_answer" };
}

/** Whether robots blocks REQ-059's permitted readers site-wide. No answer is never a condition; `absent` (a 404) permits everyone. */
function robotsReading(policy: RobotsPolicy | null): RobotsReading {
  if (policy === null) return { kind: "no_answer" };
  if (policy.absent) return { kind: "permits" };
  const blocked = AI_READER_AGENTS.some(
    (agent) => policy.disallowedAgents[agent] ?? policy.disallowsAll
  );
  return blocked ? { kind: "blocks" } : { kind: "permits" };
}

// ── The one run ─────────────────────────────────────────────────────────

/** Runs one 24-hour check and records it. Nothing is written when not due or on a part-way failure, so `dueNow` offers
 *  the row again and the job is idempotent. */
export async function verifyLive(
  publicationId: string,
  now: Date = new Date()
): Promise<VerifyRun> {
  const row = await readPublication(publicationId);
  const disposition = dispositionOf(row, now);
  if (disposition.kind !== "due") {
    return {
      recorded: false,
      because: disposition.kind === "not_yet" ? "not_yet" : disposition.kind === "done" ? "done" : "never",
    };
  }

  // `dispositionOf` already refused a null address.
  const liveUrl = await addressNow(row);
  const draft = await readDraft(row.draft_id);
  const checkedAt = now;

  const answer = await safeFetch(liveUrl, {
    timeoutMs: TIMEOUT_MS,
    userAgent: "reachkit-verify",
  });

  const classified = classify(
    answer.ok
      ? {
          status: answer.status,
          finalUrl: answer.url,
          requestedUrl: liveUrl,
          html: answer.html,
          publishedTitle: draft?.title ?? "",
        }
      : {
          status: null,
          finalUrl: null,
          requestedUrl: liveUrl,
          html: null,
          publishedTitle: draft?.title ?? "",
        }
  );

  if (classified.outcome !== "found") {
    // No checks, no failure, no cause, and no further fetch.
    const result: VerifyOutcome =
      classified.outcome === "page_not_found"
        ? { outcome: "page_not_found", status: classified.status, checkedAt }
        : { outcome: "could_not_confirm", why: classified.why, checkedAt };
    await record(row.id, { result, siteCondition: null });
    return { recorded: true, result, siteCondition: null };
  }

  // The `found` arm, and the only place the four checks are produced.
  const origin = new URL(liveUrl).origin;
  const robots = await readRobots(origin);
  const policy: RobotsPolicy | null = robots.ok ? robots : null;
  const readings = {
    sitemap: await readSitemap({ origin, robots: policy }),
    robots: robotsReading(policy),
    at: checkedAt,
  };
  const siteCondition = conditionFrom(readings);

  const checks: VerifyChecks = {
    // Always true here, and kept: see the module header.
    reachable: measured(true, checkedAt),
    indexable: indexableFrom({
      headers: answer.ok ? answer.headers : {},
      html: classified.html,
      url: liveUrl,
      at: checkedAt,
    }),
    sitemap: sitemapCheck(readings.sitemap, liveUrl, checkedAt),
    aiReadable: aiReadableCheck({
      robots: readings.robots,
      html: classified.html,
      bodyMd: draft?.body_md ?? null,
      at: checkedAt,
    }),
  };

  const result: VerifyOutcome = { outcome: "found", checks, checkedAt };
  await record(row.id, { result, siteCondition });
  return { recorded: true, result, siteCondition };
}

/** Absent from a sitemap the site publishes is `false`; no sitemap, or no answer, is `unmeasured`, never `false`. */
function sitemapCheck(reading: SitemapReading, liveUrl: string, at: Date): Measured<boolean> {
  if (reading.kind === "listed") {
    return measured(reading.urls.some((url) => sameAddress(url, liveUrl)), at);
  }
  return unmeasured<boolean>("undeterminable", at);
}

/** REQ-062 c1's fourth check: the whole content to a script-less crawler robots permits. Blocked site-wide, or robots
 *  unanswered, it is `unmeasured`; only the former names a condition. */
function aiReadableCheck(a: {
  robots: RobotsReading;
  html: string;
  bodyMd: string | null;
  at: Date;
}): Measured<boolean> {
  if (a.robots.kind !== "permits") return unmeasured<boolean>("undeterminable", a.at);
  if (a.bodyMd === null || a.bodyMd === "") return unmeasured<boolean>("undeterminable", a.at);
  return measured(bodyCoverage(a.html, a.bodyMd) >= VERIFY.coverageFloor, a.at);
}

/** The address the publication answers at now (SPEC §7): a hosted host can move under its pages, and the pages move
 *  with it, so a moved host is never `page_not_found`. A WordPress page keeps its stored address; another would be a guess. */
async function addressNow(row: VerifyRow): Promise<string> {
  const liveUrl = row.live_url!;
  if (row.destination !== "hosted") return liveUrl;
  return hostedAddressNow({ siteId: row.site_id, liveUrl });
}

async function record(
  publicationId: string,
  recorded: { result: VerifyOutcome; siteCondition: SiteCondition | null }
): Promise<void> {
  const { error } = await publishDb()
    .from<{ id: string }>("publications")
    .update({ verify: toStoredCheck(recorded) })
    .eq("id", publicationId);
  if (error !== null) throw new Error(`verifyLive(${publicationId}): could not record: ${error.message}`);
}
