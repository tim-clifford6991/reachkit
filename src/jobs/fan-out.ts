// src/jobs/fan-out.ts — BUILD §11
//
// "No job fans out across customers inside one invocation past a fixed
// concurrency; a slow site never starves the rest of Monday." The bound is
// `JOB_FAN_OUT_CONCURRENCY`; this is the loop that honours it.
//
// A worker that rejects does not cancel the fan-out — one site's failure
// is one site's failure, and the rest of Monday still runs. Results come
// back in the order the subjects were given, whatever order they finished.
import { JOB_FAN_OUT_CONCURRENCY } from "@/lib/config/constants";
import type { JobInput, Outcome, SubjectEvent } from "./types";

export type FanOutResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

export async function fanOut<S, T>(
  subjects: readonly S[],
  worker: (subject: S) => Promise<T>,
  limit: number = JOB_FAN_OUT_CONCURRENCY
): Promise<readonly FanOutResult<T>[]> {
  const results = new Array<FanOutResult<T>>(subjects.length);
  let next = 0;

  async function drain(): Promise<void> {
    while (next < subjects.length) {
      const index = next++;
      const subject = subjects[index] as S;
      try {
        results[index] = { ok: true, value: await worker(subject) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  const width = Math.max(1, Math.min(limit, subjects.length));
  await Promise.all(Array.from({ length: width }, () => drain()));
  return results;
}

/** The holds the customer's own state causes: the page waits, and the tick is decided by the other pages. */
const CUSTOMER_HOLDS: ReadonlySet<string> = new Set(["held:unpaid", "held:switch_off"]);

/** Turns a completed fan-out into the tick's one outcome.
 *
 *  A subject that *threw* wins: every subject was still attempted (that is
 *  the point of collecting results rather than failing fast), and then the
 *  first error is rethrown so the platform records a failed run. Otherwise a
 *  subject that degraded degrades the tick, naming its step, except a
 *  customer hold, which is that page waiting rather than the tick failing.
 *  Nothing here reports a success it did not have. */
export function settle<T extends { readonly done: true } | { readonly degraded: string }>(
  results: readonly FanOutResult<T>[],
  subjectId: string | null
):
  | { readonly outcome: "ran"; readonly subjectId: string | null }
  | { readonly outcome: "degraded"; readonly subjectId: string | null; readonly step: string } {
  const failure = results.find((result) => !result.ok);
  if (failure !== undefined && !failure.ok) throw failure.error;
  for (const result of results) {
    if (result.ok && "degraded" in result.value && !CUSTOMER_HOLDS.has(result.value.degraded)) {
      return { outcome: "degraded", subjectId, step: result.value.degraded };
    }
  }
  return { outcome: "ran", subjectId };
}

/** Hands a tick's subjects to their own runs, each under its key. With no
 *  platform to send through — a test, a direct call — each runs here
 *  instead, and its result is the tick's to settle. */
export async function sendSubjects(
  input: JobInput,
  events: readonly SubjectEvent[],
  run: (input: JobInput) => Promise<Outcome>
): Promise<readonly FanOutResult<{ readonly done: true } | { readonly degraded: string }>[]> {
  if (input.send !== undefined) {
    await input.send(events);
    return [];
  }
  return fanOut(events, async (event) => {
    const outcome = await run({ data: { ...event.data, key: event.key }, now: input.now });
    return outcome.outcome === "degraded" ? { degraded: outcome.step } : { done: true as const };
  });
}
