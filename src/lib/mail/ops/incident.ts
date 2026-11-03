// The owner's incident alert: no error-tracking vendor, so this seam tells `OWNER_EMAILS` when a job fails, exhausts its retries, or a deploy refuses to boot.
// Nothing here throws: a report about a failure must not become a second one. Every arm ends in one log line.
import { env } from "@/lib/config/env";
import { sendEmail } from "../send";
import { buildIncidentAlert, type OpsIncident } from "../templates/ops";

function log(occasion: OpsIncident["occasion"], outcome: string): void {
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

/** Whether at least one owner address was accepted, for a caller that stamps its own once-ness. */
export async function reportIncident(incident: OpsIncident, period?: string): Promise<boolean> {
  const mail = buildIncidentAlert(incident);
  let owners: readonly string[];
  try {
    owners = env.OWNER_EMAILS;
  } catch {
    log(incident.occasion, "no-owners");
    return false;
  }
  let accepted = false;
  for (const to of owners) {
    try {
      const result = await sendEmail({ kind: "ops", to, subject: mail.subject, blocks: mail.blocks, ...(period === undefined ? {} : { period }) });
      log(incident.occasion, result.sent ? "sent" : result.reason);
      if (result.sent) accepted = true;
    } catch {
      log(incident.occasion, "threw");
    }
  }
  return accepted;
}
