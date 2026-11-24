// A listed test site's page for a date, written now by the real pipeline so its research is seen the same day. Temporary.
// The row is undated and marked `meta.test`, claims and rests no topic, and ends `skipped` from review: no screen, mail,
// veto clock or publish reads it, and the date's scheduled write still happens.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Actor } from "@/lib/publish/types";

const scope = new AsyncLocalStorage<true>();
const BY: Actor = { kind: "system", job: "draft/test" };

/** Whether the write running now is a test draft. */
export const inTest = (): boolean => scope.getStore() === true;

type Step = <T>(name: string, body: () => Promise<T>) => Promise<T>;

/** One owner-sent test write: refused at 0¢ off the list or at a full day, else the date's page as a test draft, and one ops row. */
export async function writeTestDraft(a: { siteId: string; publishDate: string; key: string; now: Date; step: Step }): Promise<{ outcome: string; draftId: string | null; step?: string }> {
  const { isTestSite, dayRefused } = await import("@/lib/scan/weekly/rerun");
  const testing = <T>(name: string, body: () => Promise<T>) => a.step(name, () => scope.run(true, body));
  const ran = !isTestSite(a.siteId) ? { outcome: "not_a_test_site", draftId: null } : (await a.step("ceiling", () => dayRefused(a.siteId, a.now))) ? { outcome: "spend_ceiling", draftId: null } : await write(a, testing);
  const cents = ran.outcome === "not_a_test_site" || ran.outcome === "spend_ceiling" ? 0 : await a.step("cost", async () => (await import("./cost")).draftSpendSince(a.siteId, a.now));
  const { recordOpsEvent } = await import("@/lib/ops/events");
  await a.step("record", () => recordOpsEvent("draft_test", JSON.stringify({ key: a.key, publishDate: a.publishDate, ...ran, cents }), a.publishDate, a.siteId).then(() => null));
  return ran;
}

async function write(a: { siteId: string; publishDate: string; now: Date }, testing: Step): Promise<{ outcome: string; draftId: string | null; step?: string }> {
  const { decideDayPage, generateDayPage } = await import(".");
  const { askDayResearch, COLLECT } = await import("./research-queue");
  const day = { siteId: a.siteId, publishDate: a.publishDate, now: a.now, since: a.now };
  const decided = await testing("select", () => decideDayPage(day));
  // A test write's topic is never rested, so it always has one.
  if (!decided.ok || decided.opportunityId === null) return { outcome: decided.ok ? "no_opportunity" : decided.because, draftId: null };
  const research = { siteId: a.siteId, opportunityId: decided.opportunityId, now: a.now, since: a.now };
  let left = await testing("research-post", () => askDayResearch({ ...research, waitMs: COLLECT.askMs }));
  for (let round = 1; left > 0 && round <= COLLECT.rounds; round++) left = await testing(`research-collect-${round}`, () => askDayResearch({ ...research, waitMs: COLLECT.stepMs }));
  if (left > 0) return { outcome: "research_pending", draftId: null };
  const written = await testing("write", () => generateDayPage({ ...day, opportunityId: research.opportunityId }));
  const draftId = "draftId" in written ? written.draftId : null;
  // A short pack reads as one, with the step that names what it lacked, never as a failed step.
  const step = "step" in written ? written.step : undefined;
  if (draftId === null) return { outcome: written.ok ? "in_review" : step?.startsWith("pack:") ? "pack:short" : written.because, draftId, ...(step === undefined ? {} : { step }) };
  return { outcome: await testing("end", () => end(draftId)), draftId };
}

/** A passing row goes through review to `skipped` and a stopped one through `needs_attention`, under the machine, moving no topic. */
async function end(draftId: string): Promise<string> {
  const [{ generateStore }, { transition }] = await Promise.all([import("./store"), import("@/lib/publish/machine")]);
  const row = await generateStore().draftById(draftId);
  if (row === null) return "no_draft";
  // A retried step finds the row already moved on, and ends it from there.
  const via = row.state === "generating" ? (row.hard_rules_passed === true ? "in_review" : "needs_attention") : row.state;
  if (via !== "in_review" && via !== "needs_attention") return via;
  const into = row.state === "generating" ? await transition(draftId, via, BY) : { ok: true as const };
  const ended = into.ok ? await transition(draftId, "skipped", BY, { reason: "test" }) : into;
  if (!ended.ok) throw new Error(`draft/test: ${draftId} not ended from ${row.state}: ${ended.refused}`);
  return via;
}
