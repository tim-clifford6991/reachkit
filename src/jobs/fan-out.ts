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

/** Turns a completed fan-out into the tick's one outcome.
 *
 *  A subject that degraded degrades the tick, naming its step — the fan-out
 *  ran out of budget and says where. A subject that *threw* is not
 *  swallowed: every subject was still attempted (that is the point of
 *  collecting results rather than failing fast), and then the first error
 *  is rethrown so the platform records a failed run. Nothing here reports a
 *  success it did not have. */
export function settle<T extends { readonly done: true } | { readonly degraded: string }>(
  results: readonly FanOutResult<T>[],
  subjectId: string | null
):
  | { readonly outcome: "ran"; readonly subjectId: string | null }
  | { readonly outcome: "degraded"; readonly subjectId: string | null; readonly step: string } {
  for (const result of results) {
    if (result.ok && "degraded" in result.value) {
      return { outcome: "degraded", subjectId, step: result.value.degraded };
    }
  }
  const failure = results.find((result) => !result.ok);
  if (failure !== undefined && !failure.ok) throw failure.error;
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
