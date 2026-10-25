// BUILD §9 — the one place a WordPress payload stops: every answer leaves as a `FailureReason` token, never a string the
// site wrote, since §9's "never logged" covers screens, mails, exports, logs and stacks. No arm carries a body or header.
// This mapping and `verify/`'s must not be merged (BP-048): this is the REST API about a post we hold (`already_gone`),
// that is a page a reader went to (`page_not_found`).
// The default arm is not retryable (BP-048 decision 3): an unclassified answer from a site we do not own is not hammered.
import type { FailureReason } from "../../types";
import type { TransportFailure, WordPressAnswer } from "./client";

/** No answer → its reason. `too_large` and `blocked_by_policy` are not retryable: every attempt does the same. */
export function reasonForTransport(transport: TransportFailure): FailureReason {
  switch (transport) {
    case "dns":
    case "refused":
      return "network";
    case "timeout":
      return "timeout";
    case "too_large":
    case "blocked_by_policy":
      return "destination_rejected";
  }
}

/** A status → its reason. 401/403 are `credentials_expired`, fixed by Reconnect; 429 and 5xx are retryable; everything
 *  else, 404 included, is a refusal no repetition clears. */
export function reasonForStatus(status: number): FailureReason {
  if (status === 401 || status === 403) return "credentials_expired";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "destination_unavailable";
  return "destination_rejected";
}

/** Any answer → a reason, the two above joined. */
export function reasonFor(answer: WordPressAnswer): FailureReason {
  return answer.ok ? reasonForStatus(answer.status) : reasonForTransport(answer.transport);
}

/** 2xx and a body; a bodiless 204 is no answer to a call that asked for a resource back. */
export function succeeded(answer: WordPressAnswer): answer is { ok: true; status: number; body: unknown } {
  return answer.ok && answer.status >= 200 && answer.status < 300 && answer.body !== null;
}

/** ADR-086 decision 5: a create answered with a post not at `publish` is `credentials_invalid`, never `credentials_expired`.
 *  A Contributor's password can create a post WordPress quietly holds at `draft`: a page reported published, invisible.
 *  `credentials_expired` would mark the destination `expired` and offer Reconnect, which REQ-060 c7 says is never offered here. */
export const NOT_PUBLISHED: FailureReason = "credentials_invalid";

/** What a call about a post we hold found. `gone` (a 404) and `unreachable` (transport or 5xx, the post may be live)
 *  stay separate, or one of §9's four unpublish outcomes becomes unreachable. */
export type PostAnswer =
  | { kind: "ok"; body: unknown }
  | { kind: "gone" }
  | { kind: "unreachable" }
  | { kind: "failed"; reason: FailureReason };

export function classifyPostAnswer(answer: WordPressAnswer): PostAnswer {
  if (!answer.ok) return { kind: "unreachable" };
  if (answer.status === 404) return { kind: "gone" };
  if (answer.status >= 500) return { kind: "unreachable" };
  if (answer.status >= 200 && answer.status < 300 && answer.body !== null) {
    return { kind: "ok", body: answer.body };
  }
  return { kind: "failed", reason: reasonForStatus(answer.status) };
}
