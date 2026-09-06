// BUILD §9 — "**Verification:** publish +24h → fetch the live URL, confirm
// reachable/indexable/in-sitemap/AI-readable".
//
// One fetch of the page's own address, once, ever, and exactly one of
// REQ-062 criterion 4's three outcomes recorded against the publication.
//
// **The four checks are produced in the `found` arm and in no other.**
// `page_not_found` and `could_not_confirm` produce no checks, state no
// failure of the page and name no cause — criterion 4 forbids all three in
// terms, and neither arm makes the sitemap or robots fetches, which exist
// only to decide checks those arms do not produce.
//
// **`could_not_confirm` must never be folded into `reachable: false`
// (ADR-085, landmine).** That turns ReachKit's own network problem into an
// accusation against the customer's page. It reads as tidying up an
// obviously incomplete union and it passes every test that would exist
// without the arm-separation rows in `tests/publish/verify/verify.test.ts`.
//
// **`reachable` is `true` in every `found` result, and is not deleted for
// it.** Every way a page could be unreachable now lands in criterion 4's
// third outcome, so the arm that produces the four checks is only ever
// reached by a 200 carrying our page. The check has one value in production
// and reads exactly like a field nobody needs. It is kept because REQ-062
// criteria 1, 2 and 3 promise the customer **four** outcomes with their
// dates, and because criterion 3 requires all four to state that they have
// not been checked yet in the 24 hours before the check runs — a promise a
// three-outcome surface cannot keep. Deleting it is a surface change, not a
// cleanup.
//
// **The user agent is our own token.** `VERIFY.userAgent` is not one of the
// six pinned AI readers: impersonating one would be a false statement to a
// server we are measuring, and the robots document ReachKit serves blocks
// no general crawler.
//
// **Nothing here retries.** `dueNow` (`due.ts`) selects only rows with no
// recorded outcome; this module runs once per publication and returns.
//
// The archived plan is WO-234.
import { AI_READER_AGENTS, VERIFY } from "@/lib/config/constants";
import { readRobots, safeFetch } from "@/lib/egress";
import type { RobotsPolicy } from "@/lib/egress/types";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { parseOnPage } from "@/lib/measure/parse";
import { publishDb } from "../db";
import type { SiteCondition, VerifyChecks, VerifyOutcome } from "../types";
import { classify } from "./answer";
import { bodyCoverage } from "./coverage";
import { dispositionOf, DISPOSITION_COLUMNS, PublicationNotFound, type DispositionRow } from "./due";
import { conditionFrom, type RobotsReading, type SitemapReading } from "./site";
import { toStoredCheck } from "./stored";

/** Declared in `src/lib/publish/types.ts` and re-exported here (ADR-092):
 *  the page record must name the recorded outcome, and declaring these
 *  under `verify/` would make `record/ → verify/ → types.ts` a node cycle.
 *  The behaviour behind every arm is this module's. */
export type { NotConfirmed, VerifyChecks, VerifyDisposition, VerifyOutcome } from "../types";

/** Declared in `checks.ts` — a module with no database of its own, so the
 *  mail template that renders the four rows can read the list without
 *  reaching one — and re-exported here, beside the code that produces
 *  them. */
export { CHECK_IDS, type CheckId } from "./checks";

/** What one run of the check did. A run that recorded nothing says which of
 *  the dispositions held instead — never a fabricated outcome, and never a
 *  silent success. */
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

/** The two addresses a site publishes its sitemap at when its robots
 *  document names none. Conventional, not pinned: they are the addresses
 *  the sitemaps.org protocol and every CMS in use put the document at, and
 *  they are read here, never written anywhere. */
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

/** REQ-062 criterion 1's "is not marked against indexing".
 *
 *  **Both the header and the document are read, because either alone can be
 *  the one that is set.** `X-Robots-Tag` is a response header and cannot be
 *  recovered from the markup: a page marked `noindex` by header alone and
 *  one marked by nothing at all are the same string. That is why
 *  `FetchOutcome`'s `ok` arm carries the headers at all. */
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

/**
 * Reads the sitemap the site publishes, following a sitemap index up to
 * `VERIFY.sitemapMaxDocuments` documents in all.
 *
 * The three readings are the whole of the distinction criterion 6 turns on:
 * a site that **answered** that it publishes no sitemap is a condition of
 * that site; a document that did not answer, or that came back unreadable,
 * is no condition at all and costs this one page's check alone.
 */
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
      // The site answered, and the answer is that there is nothing there.
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
  // Nothing named a document, nothing failed to answer, and every address
  // asked answered that there is nothing there. That is the site saying it
  // publishes no sitemap.
  return sawAbsent && declared.length === 0 ? { kind: "none" } : { kind: "no_answer" };
}

/** Whether the site's own robots document blocks the readers REQ-059's
 *  policy permits, across the whole site.
 *
 *  A document that did not answer is `no_answer` and is never a condition —
 *  and `absent` (a 404 for `/robots.txt`) is an answer with nothing in it,
 *  which permits everyone. */
function robotsReading(policy: RobotsPolicy | null): RobotsReading {
  if (policy === null) return { kind: "no_answer" };
  if (policy.absent) return { kind: "permits" };
  const blocked = AI_READER_AGENTS.some(
    (agent) => policy.disallowedAgents[agent] ?? policy.disallowsAll
  );
  return blocked ? { kind: "blocks" } : { kind: "permits" };
}

// ── The one run ─────────────────────────────────────────────────────────

/**
 * Runs one publication's 24-hour check and records its outcome.
 *
 * Nothing is written where the check is not due, and nothing is written
 * when the run fails part-way: the row keeps a null `verify` and is offered
 * again by `dueNow`, which is what makes the job idempotent without
 * remembering anything.
 */
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

  // `dispositionOf` has already refused a null address; the local is what
  // narrows the type without a second rule about when an address exists.
  const liveUrl = row.live_url!;
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
    // Neither arm produces the four checks, states a failure of the page or
    // names a cause — and neither makes the two further fetches, which
    // exist only to decide checks these arms do not produce.
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
    // True in every `found` result: the arm is reached only by a 200
    // carrying our page. Kept, not deleted — see the module header.
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

/** A page absent from a sitemap the site **does** publish is that page
 *  failing, stated plainly as `false`. A site that answered that it
 *  publishes none, and a document that did not answer at all, are both
 *  `unmeasured` — never `false`, because this page did not fail either of
 *  them. */
function sitemapCheck(reading: SitemapReading, liveUrl: string, at: Date): Measured<boolean> {
  if (reading.kind === "listed") {
    return measured(reading.urls.some((url) => sameAddress(url, liveUrl)), at);
  }
  return unmeasured<boolean>("undeterminable", at);
}

/** REQ-062 criterion 1's fourth check: does the page return its whole
 *  content to a crawler that runs no scripts and identifies as one the
 *  robots policy permits?
 *
 *  Both halves are required. Where the site's robots document blocks those
 *  readers across the whole site, the question is not about this page and
 *  the check is `unmeasured` with the condition named separately; where the
 *  document did not answer, it is `unmeasured` for this page alone and no
 *  condition is written and no later page's check is suppressed. */
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
