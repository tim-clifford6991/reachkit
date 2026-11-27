// The owner's operations mail: no error-tracking vendor, so this seam tells `OWNER_EMAILS`. Only a page that failed to publish,
// a payment or sign-in path that is down, and a refused spend are sent at once; every other occasion is an `ops_events` row that
// one daily digest lists. Nothing here throws: a report about a failure must not become a second one. Every arm ends in one log line.
import { env } from "@/lib/config/env";
import { sendEmail } from "../send";
import { buildIncidentAlert, buildOwnerDigest, type DigestLine, type MarketWeek, type OpsAlertMail, type OpsIncident } from "../templates/ops";

function log(occasion: string, outcome: string): void {
  console.warn(JSON.stringify({ event: "ops_incident_alert", occasion, outcome }));
}

/** An error's class name, never its message. */
export function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

/** One owner mail per (job, error class, day); `job_error_mails`'s primary key decides it. */
export interface ErrorMailKey {
  readonly jobId: string;
  readonly errorName: string;
  /** The calendar day the caller counts in, `YYYY-MM-DD`. */
  readonly day: string;
}

interface ClaimQuery extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  upsert(values: Record<string, unknown>, options: { onConflict: string; ignoreDuplicates: boolean }): ClaimQuery;
  select(columns: string): ClaimQuery;
  delete(): ClaimQuery;
  eq(column: string, value: unknown): ClaimQuery;
}

// The client, not the query: a query is thenable, and an async function returning one would run it.
async function claims(): Promise<{ from(table: "job_error_mails"): ClaimQuery }> {
  const { dbAdmin } = await import("@/lib/db");
  return dbAdmin() as unknown as { from(table: "job_error_mails"): ClaimQuery };
}

/** True when this caller inserted the key, the one that sends. Throws when the table cannot answer. */
export async function claimOwnerMail(key: ErrorMailKey, at: Date): Promise<boolean> {
  // `ignoreDuplicates` is `insert … on conflict do nothing returning`: only the inserting caller gets a row back.
  const { data, error } = await (await claims()).from("job_error_mails")
    .upsert(
      { job_id: key.jobId, error_name: key.errorName, day: key.day, mailed_at: at.toISOString() },
      { onConflict: "job_id,error_name,day", ignoreDuplicates: true }
    )
    .select("job_id");
  if (error !== null) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/** Deletes the claim, so a mail that was not sent does not use up the day. */
export async function releaseOwnerMail(key: ErrorMailKey): Promise<void> {
  const { error } = await (await claims()).from("job_error_mails")
    .delete()
    .eq("job_id", key.jobId)
    .eq("error_name", key.errorName)
    .eq("day", key.day);
  if (error !== null) throw new Error(error.message);
}

/** Sends one mail to every owner address, each result logged; true when at least one was accepted. */
export async function mailOwners(mail: OpsAlertMail, event: string, logOutcome: (outcome: string) => void): Promise<boolean> {
  let owners: readonly string[];
  try {
    owners = env.OWNER_EMAILS;
  } catch {
    logOutcome("no-owners");
    return false;
  }
  let accepted = false;
  for (const to of owners) {
    try {
      const result = await sendEmail({ kind: "ops", to, subject: mail.subject, blocks: mail.blocks, event });
      logOutcome(result.sent ? "sent" : result.reason);
      if (result.sent) accepted = true;
    } catch {
      logOutcome("threw");
    }
  }
  return accepted;
}

const DIGEST = "owner-digest";
/** One row per digest sent; its `read` is the last digest row it listed. */
const DIGESTED = "owner-digest-sent";
const today = () => new Date().toISOString().slice(0, 10);

type DigestRow = { readonly read: string; readonly code: string };

/** Rows in id order become one line per occasion, in the order each first appeared. */
function linesOf(rows: readonly DigestRow[]): DigestLine[] {
  const lines = new Map<string, { count: number; codes: Set<string> }>();
  for (const row of rows) {
    const line = lines.get(row.read) ?? { count: 0, codes: new Set<string>() };
    line.count += 1;
    line.codes.add(row.code);
    lines.set(row.read, line);
  }
  return [...lines].map(([occasion, line]) => ({ occasion, count: line.count, codes: [...line.codes] }));
}

/** Stores an occasion for the next digest, one row per short code. Where no row can be written, those lines go now as a digest
 *  of their own, so nothing is dropped. True when stored or accepted. */
export async function tellOwner(occasion: string, codes: readonly string[], period = today()): Promise<boolean> {
  const rows = (codes.length > 0 ? codes : ["-"]).map((code) => ({ kind: DIGEST, read: occasion, code: code.slice(0, 40) }));
  try {
    const { dbAdmin } = await import("@/lib/db");
    const { error } = await dbAdmin().from("ops_events").insert(rows);
    if (error === null) {
      log(occasion, "stored");
      return true;
    }
  } catch {
    // Told at once below.
  }
  return mailOwners(buildOwnerDigest(linesOf(rows), null), `${period}/${occasion}/${rows.map((row) => row.code).join(",")}`, (outcome) => log(occasion, outcome));
}

/** Where each incident goes: a mail told at once, or the digest rows' short codes. A new occasion without a route fails typecheck. */
type Route = { [K in OpsIncident["occasion"]]: (incident: Extract<OpsIncident, { occasion: K }>) => OpsAlertMail | readonly string[] };

/** A failing job is told at once when it is publishing, or when the database it claims in is not answering. */
const job = (i: Extract<OpsIncident, { occasion: "job-failed" | "dead-lettered" }>) =>
  i.down === true || i.jobId.startsWith("publish/") ? buildIncidentAlert(i) : [`${i.jobId} ${i.errorName}`];

const ROUTE: Route = {
  "job-failed": job,
  "dead-lettered": job,
  "boot-refused": buildIncidentAlert,
  "sign-in-unsent": buildIncidentAlert,
  "no-draft-at-publish": buildIncidentAlert,
  "autopilot-stalled": buildIncidentAlert,
  "market-too-small": (i) => [i.tier],
  "job-stale": (i) => i.jobId.startsWith("publish/") || i.jobId === "account/maintenance" ? buildIncidentAlert(i) : [i.jobId],
  "draft-stopped-twice": (i) => [i.domain],
  "replan-committed": (i) => i.sites.map((site) => site.domain),
  "serp-unreadable": (i) => [i.cause],
  "vendor-low": (i) => [`$${(i.balanceCents / 100).toFixed(2)}${i.daysLeft === null ? "" : `, ${Math.floor(i.daysLeft)} days`}`],
  "mail-stopped": (i) => i.domains.map((domain) => `${domain} ${i.cause}`),
  "step-retried": (i) => [`${i.step} attempt ${i.attempt} ${i.cents}¢`],
  "weekly-failed": (i) => [`${i.weekStart} ${i.reason} → ${i.retake}`],
  hot: (i) => [i.because === null ? `${i.stories ?? "?"} stories, ${i.events} events, ${i.offered.length} offered: ${i.offered.join("; ")}` : `none, because ${i.because}`],
};

/** Whether the occasion was told at once or stored, for a caller that stamps its own once-ness. */
export async function reportIncident(incident: OpsIncident, period?: string): Promise<boolean> {
  const routed = (ROUTE[incident.occasion] as (i: OpsIncident) => OpsAlertMail | readonly string[])(incident);
  if (Array.isArray(routed)) return tellOwner(incident.occasion, routed, period);
  const mail = routed as OpsAlertMail;
  return mailOwners(mail, `${period ?? today()}/${JSON.stringify(incident)}`, (outcome) => log(incident.occasion, outcome));
}

/** The digest's hour: the owner reads one mail a day, after the night's work. */
export const DIGEST_HOUR_UTC = 7;
/** One page of rows per digest: a larger backlog is the next day's. */
const ROWS_PER_DIGEST = 500;

/** The UTC day whose digest may be due, from its hour on. */
export function ownerDigestDue(now: Date): readonly string[] {
  return now.getUTCHours() >= DIGEST_HOUR_UTC ? [now.toISOString().slice(0, 10)] : [];
}

/** The week's section where one is due, and the stamp that settles it once the digest is accepted. */
export type WeekSection = { readonly week: MarketWeek | null; settle(): Promise<void> } | null;

/** Sends the day's one digest: every stored row since the last digest, oldest first, and the week's section where one is due.
 *  The day's `job_error_mails` claim makes a second tick send nothing; a digest not accepted releases it. False when not accepted. */
export async function sendOwnerDigest(day: string, now: Date, weekSection: () => Promise<WeekSection>): Promise<boolean> {
  const key = { jobId: DIGEST, errorName: "daily", day };
  if (!(await claimOwnerMail(key, now))) return true;
  let accepted = false;
  try {
    const { dbAdmin } = await import("@/lib/db");
    const events = () => dbAdmin().from("ops_events");
    const last = await events().select("read").eq("kind", DIGESTED).order("id", { ascending: false }).limit(1);
    if (last.error !== null) throw new Error(`owner digest: ${last.error.message}`);
    const stored = await events().select("id, read, code").eq("kind", DIGEST).gt("id", Number(last.data[0]?.read ?? 0)).order("id").limit(ROWS_PER_DIGEST);
    if (stored.error !== null) throw new Error(`owner digest: ${stored.error.message}`);
    const section = await weekSection();
    // A day with nothing to say sends nothing; the week's read rows are still settled.
    if (stored.data.length === 0 && (section === null || section.week === null)) {
      accepted = true;
      await section?.settle();
      return true;
    }
    accepted = await mailOwners(buildOwnerDigest(linesOf(stored.data), section?.week ?? null), `digest/${day}`, (outcome) => log(DIGEST, outcome));
    if (!accepted) return false;
    const through = stored.data.at(-1)?.id;
    if (through !== undefined) {
      const { error } = await events().insert({ kind: DIGESTED, read: String(through), code: day });
      if (error !== null) throw new Error(`owner digest: ${error.message}`);
    }
    await section?.settle();
    return true;
  } finally {
    if (!accepted) await releaseOwnerMail(key).catch(() => undefined);
  }
}
