// src/lib/account/provisioning/deep-pass.ts — BUILD §13
//
// The port the deep pass is queued through.
//
// §13: provisioning must "queue deep pass". The job registry is
// `src/jobs/**` and `src/lib/**` never imports it (ARCHITECTURE rule 2), so
// the queue arrives here as a registration rather than as an import — the
// same shape `src/lib/scan/correction.ts` uses for its own runner.
//
// **Queued, never awaited.** REQ-024 criterion 1 gives the sign-in link 60
// seconds from the charge; a deep pass is minutes of vendor work. The
// caller starts this and moves on, and a failure to enqueue is reported
// rather than thrown: a founder whose account opened must not be told their
// payment failed because a queue was briefly unreachable.
//
// **Not queued for a scanless purchase.** There is no domain to run it
// against until setup asks for one (REQ-021 c7), and `siteId`'s companion
// `domain` being `null` is exactly that state. `provisionFromPayment`
// decides; this file only carries.

export interface DeepPassRequest {
  readonly siteId: string;
  readonly domain: string;
}

export type DeepPassQueue = (request: DeepPassRequest) => Promise<void>;

let queue: DeepPassQueue | null = null;

/** Wired by `src/jobs/**`; `null` unwires. */
export function registerDeepPassQueue(next: DeepPassQueue | null): void {
  queue = next;
}

export type QueueOutcome = "queued" | "not_wired" | "failed";

export async function queueDeepPass(request: DeepPassRequest): Promise<QueueOutcome> {
  if (queue === null) return "not_wired";
  try {
    await queue(request);
    return "queued";
  } catch {
    return "failed";
  }
}
