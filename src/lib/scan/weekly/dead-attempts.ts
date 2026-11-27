// A weekly step that runs again after its attempt died is told to the owner's digest, with what the dead attempt spent, and the pass then reads degraded.
// The spend is the scan's ledger now less what it held when the last step answered; each step's answer carries that figure, so a retry reads it back.
import type { PassStep } from "./first";
import { scanCents } from "./store";

type Watched<T> = { readonly value: T; readonly cents: number; readonly dead: boolean };

/** The pass's row, learnt from the first answer that names one: the claim's. */
const scanOf = (value: unknown): string | undefined => (typeof value === "object" && value !== null && "scanId" in value && typeof value.scanId === "string" ? value.scanId : undefined);

function isWatched(answer: unknown): answer is Watched<unknown> {
  return typeof answer === "object" && answer !== null && "dead" in answer && "cents" in answer;
}

/** `step`, watched: `attempt` is the platform's count for the step this invocation runs, `0` the first. */
export function watchedSteps(step: PassStep, a: { siteId: string; attempt: number }): { step: PassStep; died(): boolean } {
  let scanId: string | undefined, settled = 0, died = false;
  const spent = async () => (scanId === undefined ? 0 : await scanCents(scanId));
  const watched: PassStep = async <T>(name: string, body: () => Promise<T>) => {
    const answer = await step(name, async (): Promise<Watched<T>> => {
      const dead = a.attempt > 0;
      if (dead) {
        const { reportIncident } = await import("@/lib/mail/ops");
        await reportIncident({ occasion: "step-retried", step: name.replace(`-${a.siteId}`, ""), attempt: a.attempt, cents: Math.max(0, (await spent()) - settled) });
      }
      const value = await body();
      scanId ??= scanOf(value);
      return { value, cents: await spent(), dead };
    });
    // An answer stored before steps were watched is handed back as it was.
    if (!isWatched(answer)) return answer as T;
    scanId ??= scanOf(answer.value);
    settled = answer.cents;
    died ||= answer.dead;
    return answer.value as T;
  };
  return { step: watched, died: () => died };
}
