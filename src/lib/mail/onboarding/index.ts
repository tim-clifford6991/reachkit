// SPEC §8, Onboarding mails — the two once-per-site `account` notices after payment: "setup done" with what the first check
// found, at the later of setup's finish and the first pass's end, then "connected" once the address is first live, never
// before the first. The first page's own mail asks here first, so neither ever follows it. Each trigger only asks; each mail is claimed on its `sites` stamp before the send, so a second delivery
// of any trigger sends nothing, and a send that failed gives its claim back for the next trigger.
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import { committedWeek } from "@/lib/opportunities";
import { opportunityStore } from "@/lib/opportunities/store";
import { liveDestinations } from "@/lib/publish/destinations/store";
import { lastPass } from "@/lib/scan/deep/pass-end";
import { sendEmail } from "../send";
import { buildConnected, buildSetupDone } from "../templates/account/onboarding";
import type { AccountMail } from "../templates/magic-link";

type Stamp = "setup_done_mail_sent_at" | "connected_mail_sent_at";

interface SiteRow {
  id: string;
  user_id: string;
  domain: string;
  category: string | null;
  timezone: string | null;
  setup_completed_at: string | null;
  setup_done_mail_sent_at: string | null;
  connected_mail_sent_at: string | null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The generated `Database` type lacks the `sites.setup_*` columns, as in `src/lib/scan/deep/release.ts`. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const SITE_COLUMNS =
  "id, user_id, domain, category, timezone, setup_completed_at, setup_done_mail_sent_at, connected_mail_sent_at";

export type OnboardingMailsOutcome = { sent: readonly Stamp[] };

/** Sends whichever onboarding mail is due for the site, in order. Never throws: a trigger is setup, a pass or a check. */
export async function sendOnboardingMails(siteId: string, now: Date = new Date()): Promise<OnboardingMailsOutcome> {
  const sent: Stamp[] = [];
  try {
    const site = await readSite(siteId);
    if (site === null || site.connected_mail_sent_at !== null) return { sent };
    const to = await emailOf(site.user_id);
    if (to === null) return { sent };

    let setupDone = site.setup_done_mail_sent_at !== null;
    if (!setupDone && (await setupDoneDue(site))) {
      setupDone = await claimAndSend(site, "setup_done_mail_sent_at", to, now, () => setupDoneMail(site, now));
      if (setupDone) sent.push("setup_done_mail_sent_at");
    }
    if (!setupDone || site.connected_mail_sent_at !== null) return { sent };
    const host = await connectedHost(site);
    if (host === null) return { sent };
    if (await claimAndSend(site, "connected_mail_sent_at", to, now, () => connectedMail(site, host, now))) {
      sent.push("connected_mail_sent_at");
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: "onboarding_mail_failed", siteId, detail: String(error) }));
  }
  return { sent };
}

async function readSite(siteId: string): Promise<SiteRow | null> {
  const { data, error } = await untyped().from<SiteRow>("sites").select(SITE_COLUMNS).eq("id", siteId).limit(1);
  if (error !== null) throw new Error(`sendOnboardingMails: ${error.message}`);
  return data?.[0] ?? null;
}

async function emailOf(userId: string): Promise<string | null> {
  const { data, error } = await untyped().from<{ email: string | null }>("users").select("email").eq("id", userId).limit(1);
  if (error !== null) throw new Error(`sendOnboardingMails: ${error.message}`);
  return data?.[0]?.email ?? null;
}

/** Setup finished and the first pass's row has ended; the release latch is later, after the first draft. */
async function setupDoneDue(site: SiteRow): Promise<boolean> {
  if (site.setup_completed_at === null) return false;
  return (await lastPass(site.id))?.kind === "ended";
}

/** The claim, then the send; a failed send clears this claim only, so the next trigger tries again. */
async function claimAndSend(site: SiteRow, stamp: Stamp, to: string, now: Date, build: () => Promise<AccountMail>): Promise<boolean> {
  const at = now.toISOString();
  const claimed = await untyped().from<{ id: string }>("sites").update({ [stamp]: at }).eq("id", site.id).is(stamp, null).select("id");
  if (claimed.error !== null) throw new Error(`sendOnboardingMails: ${claimed.error.message}`);
  if ((claimed.data ?? []).length === 0) return false;
  let result: Awaited<ReturnType<typeof sendEmail>> = { sent: false, reason: "not-composable" };
  try {
    const mail = await build();
    // The site in the vendor key, so two sites of one founder are two mails.
    result = await sendEmail({ kind: "account", to, period: site.id, ...mail });
  } finally {
    if (!result.sent) await untyped().from<never>("sites").update({ [stamp]: null }).eq("id", site.id).eq(stamp, at);
  }
  return result.sent;
}

async function setupDoneMail(site: SiteRow, now: Date): Promise<AccountMail> {
  const [pass, rivals, waiting, week] = await Promise.all([
    lastPass(site.id),
    trackedRivals(site.id),
    opportunityStore().countUnused(site.id),
    committedWeek(site.id),
  ]);
  const partial = pass?.kind !== "ended" || pass.end.outcome !== "done";
  return buildSetupDone({
    domain: site.domain,
    market: site.category?.trim() || null,
    rivals,
    // A short pass that found none did not measure none.
    searches: partial && waiting === 0 ? null : waiting,
    partial,
    week: week.days.flatMap((day) => (day.opportunity.targetQuery === null ? [] : [{ date: day.date, search: day.opportunity.targetQuery }])),
    planHref: new URL("/app/calendar", env.NEXT_PUBLIC_APP_URL).toString(),
    at: now,
  });
}

/** The address pages go live at: the hosted host once the domain list says live, else a healthy WordPress site's domain. */
async function connectedHost(site: SiteRow): Promise<string | null> {
  const destination = (await liveDestinations(site.id))[0];
  if (destination === undefined) return null;
  if (destination.kind === "hosted") return destination.hostname_state === "live" ? destination.hostname : null;
  return destination.health === "ok" ? site.domain : null;
}

async function connectedMail(site: SiteRow, host: string, now: Date): Promise<AccountMail> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: site.timezone ?? "UTC" }).format(now);
  const days = (await committedWeek(site.id)).days.map((day) => day.date).filter((date) => date >= today).sort();
  return buildConnected({ host, firstDay: days[0] ?? null });
}
