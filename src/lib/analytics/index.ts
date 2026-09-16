// Owner ruling 2026-09-16 (issue 336) — product analytics: three events, and
// no others.
//
//   `scan_started`    a pass began, with its tier.
//   `paid`            a payment provisioned an account.
//   `draft_published` a page went live at its destination.
//
// That is the closed set. A fourth event is a change to what this product
// records about the people who use it, so it is an owner ruling and not a
// call site's decision — `ANALYTICS_EVENTS` is the list, and `capture()`
// takes no string outside it.
//
// **No PII leaves here.** The subject of every event — a domain, a user id,
// a site id — is hashed before it goes (`subjectDigest`, the twelve hex
// characters `recipientDigest` already uses for mail), so PostHog holds a
// stable handle for a funnel and never an address, an email or a customer's
// site. The only property any event carries is the scan's tier, which is one
// of three words this product chose. There is no `$ip`, no user agent and no
// page URL: this is a server-side capture, and `$process_person_profile` is
// false so no person profile is built from it.
//
// **It never throws and never blocks.** A call site records what happened
// and carries on: the send is awaited only as far as the seam, every failure
// is one log line, and a deployment carrying no key captures nothing at all
// (the same shape `src/lib/vendors/vercel/domains.ts` takes for an absent
// token). Analytics that could fail a scan, a payment or a publish would be
// worse than no analytics.
//
// Every byte leaves through `safeFetch`, the one door (BUILD §6.4).
import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import { safeFetch } from "@/lib/egress";

/** The owner's three, and nothing else (2026-09-16). */
export const ANALYTICS_EVENTS = ["scan_started", "paid", "draft_published"] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** The one property any event carries: which pass began. Closed, because a
 *  free scan and a paid one are the funnel's own two halves. */
export type ScanTier = "free" | "deep" | "weekly";

/** PostHog's default ingestion host. The vendor's own address, declared
 *  beside the one module that calls it — the idiom the Vercel and
 *  DataForSEO adapters set — and overridable for a project on another
 *  region's host. */
const DEFAULT_HOST = "https://us.i.posthog.com";

const CAPTURE_PATH = "/i/v0/e/";

/** Two seconds: an event is worth a moment of a job's time and not more.
 *  Nothing downstream waits on the answer. */
const TIMEOUT_MS = 2_000;

/** A stable handle for one subject, and nothing that identifies it. The
 *  same digest mail's own log line uses, so an operator comparing the two
 *  sees the same twelve characters for the same address. */
export function subjectDigest(subject: string): string {
  return createHash("sha256").update(subject.trim().toLowerCase()).digest("hex").slice(0, 12);
}

function log(event: AnalyticsEvent, outcome: string): void {
  console.log(JSON.stringify({ event: "analytics", name: event, outcome }));
}

/**
 * Records one of the three events.
 *
 * `subject` is hashed here — a caller passes the domain, user id or site id
 * it already holds and never a digest of its own, so there is one hashing
 * rule and not three. Returns whether the vendor accepted it, for a test;
 * no call site reads it.
 */
export async function capture(
  event: AnalyticsEvent,
  a: { subject: string; tier?: ScanTier }
): Promise<boolean> {
  const key = env.POSTHOG_API_KEY;
  // A deployment that was given no key records nothing, and says so once.
  if (key === undefined) {
    log(event, "not-configured");
    return false;
  }

  const outcome = await safeFetch(`${env.POSTHOG_HOST ?? DEFAULT_HOST}${CAPTURE_PATH}`, {
    method: "POST",
    respectRobots: false,
    timeoutMs: TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: subjectDigest(a.subject),
      properties: {
        // No person profile: this is a server event about a pass, a payment
        // or a page, and nothing here is a person PostHog should model.
        $process_person_profile: false,
        ...(a.tier === undefined ? {} : { tier: a.tier }),
      },
    }),
  });

  const accepted = outcome.ok && outcome.status >= 200 && outcome.status < 300;
  log(event, accepted ? "sent" : outcome.ok ? `status-${outcome.status}` : "no-answer");
  return accepted;
}

/** The same capture, for a call site that must not wait on it at all: the
 *  send is started and its failure is already swallowed inside `capture`. */
export function captureInBackground(event: AnalyticsEvent, a: { subject: string; tier?: ScanTier }): void {
  void capture(event, a).catch(() => log(event, "threw"));
}
