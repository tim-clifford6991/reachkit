// src/jobs/client.ts — BUILD §11
//
// **The platform choice, and the only file that names it.**
//
// `BUILD.md` §1's stack table: "Jobs | **Inngest** (or Vercel cron +
// queue)". Inngest is taken, on §1's own bolding and on what the seven jobs
// need that a bare cron does not: at-least-once delivery with durable
// retry, an idempotency key per delivery, a per-function concurrency bound,
// and a scheduled delay (`publish/verify`'s +24h) that is not a table of
// pending rows this product would otherwise have to grow and sweep itself.
// It adds no dependency — `inngest` is already pinned in `package.json` —
// so the alternative's only advantage does not apply.
//
// Everything platform-shaped lives here: the client, the mapping from a
// neutral `JobDefinition` to a platform function, and the HTTP handler set.
// No other file under `src/jobs/`, and no file under `src/lib/`, names the
// platform — `tests/jobs/registry.test.ts` asserts it. Swapping the
// platform is therefore this file plus the one route that mounts it.
//
// **The two bindings** — `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` —
// are members of `src/lib/config/env.ts` since issue #315, reversing the
// 2026-09-05 ruling that kept them out as "the SDK's own bindings". They
// still *are* the SDK's own bindings: it reads both from `process.env` by
// those names, and nothing in this file passes them. What changed is that
// the deployment contract now declares them — `BUILD.md` §15 always named
// them — and `assertJobsBindings()` refuses the boot of a real deployment
// that carries neither. Before that, such a deployment started, served
// every screen, and ran no job at all, with nothing saying so.
//
// This file does not import `env`, deliberately. Both bindings are
// server-only, so reading one at module load would throw wherever this
// module is loaded in a browser-like environment — and it is: the setup
// store imports `sendJobEvent`, and that store is reached from a rendered
// screen. `tests/jobs/client-bindings.test.ts` is what keeps the two names
// honest instead: it asserts the client resolves exactly the names the
// schema declares, so a rename in one place cannot silently miss the other.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-05: The job platform is Inngest (BUILD §1), named in exactly one file,
//   `src/jobs/client.ts`; `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are the SDK's own
//   bindings, not members of env.ts. — #86

import { Inngest } from "inngest";
import { serve as serveFunctions } from "inngest/next";
import { runJob } from "./run";
import type { JobDefinition, JobEvent } from "./types";

/** The application id, stable across deployments — renaming it orphans
 *  every function's history, so it is written once, here. */
export const APP_ID = "reachkit";

export const client = new Inngest({ id: APP_ID });

type PlatformFunction = ReturnType<typeof client.createFunction>;

/** The neutral idempotency key (`["draftId", "destinationId"]`) as the
 *  platform's own expression. A job file states field names; only this
 *  function knows what the platform does with them. */
function idempotencyExpression(fields: readonly string[]): string | undefined {
  if (fields.length === 0) return undefined;
  return fields.map((field) => `event.data.${field}`).join(' + "/" + ');
}

function triggerOf(definition: JobDefinition): { event: string } | { cron: string } {
  return definition.trigger.kind === "cron"
    ? { cron: definition.trigger.cron }
    : { event: definition.trigger.event };
}

/** Maps one `JobDefinition` onto the platform. The body is always
 *  `runJob()`, so the kill-switch guard and the one log line are applied to
 *  every job by construction rather than by each definition remembering. */
export function defineJob(definition: JobDefinition): PlatformFunction {
  const idempotency = idempotencyExpression(definition.idempotencyKey);
  const afterHours =
    definition.trigger.kind === "event" ? definition.trigger.afterHours : undefined;

  return client.createFunction(
    {
      id: definition.id.replace("/", "-"),
      name: definition.id,
      triggers: [triggerOf(definition)],
      ...(idempotency === undefined ? {} : { idempotency }),
    },
    async ({ event, step }) => {
      if (afterHours !== undefined) {
        await step.sleep("declared-delay", `${afterHours}h`);
      }
      return step.run("job", () =>
        runJob(definition, {
          data: (event?.data ?? {}) as Readonly<Record<string, unknown>>,
          now: new Date(),
        })
      );
    }
  );
}

/**
 * Sends one event onto the queue.
 *
 * The platform's own `send`, kept here for the reason everything else
 * platform-shaped is: this is the only file that names the platform, so a
 * caller that wants work queued asks for an event by its `JobEvent` name
 * and learns nothing about what carries it. The name is typed, so an event
 * no registered job listens for does not compile.
 *
 * At-least-once: the receiving job's `idempotencyKey` is what makes a
 * second delivery harmless, and every event sent here carries the fields
 * that key names.
 */
export async function sendJobEvent(
  event: JobEvent,
  data: Readonly<Record<string, unknown>>
): Promise<void> {
  await client.send({ name: event, data });
}

/** The HTTP handler set the `/api/jobs` route mounts. It serves exactly the
 *  definitions it is given — an unregistered job is unreachable. */
export function serveJobs(definitions: readonly JobDefinition[]) {
  return serveFunctions({ client, functions: definitions.map(defineJob) });
}
