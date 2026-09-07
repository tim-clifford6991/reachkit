// BUILD §9 — the one place a WordPress payload stops.
//
// Every answer the customer's site gives is classified here and nowhere
// else, and what leaves this module is a `FailureReason` — a token from a
// closed union — and never a string the site wrote. §9's "credentials
// encrypted at rest, never logged" is a promise about every route a value
// can take to a person: a screen, a mail, an export, a log line, a thrown
// stack. So no arm below carries a body, a header, a status message or a
// fragment of the request.
//
// **This mapping and the verification mapping are two mappings and must
// not be merged** (BP-048, in terms). This file classifies an answer to
// *the REST API about a post id ReachKit holds*; `verify/`'s classifies an
// answer to *the page's own public address that a reader went to*. They run
// against the same host and mean different things: `already_gone` is a fact
// about a post ReachKit is trying to write to, `page_not_found` is a fact
// about a page a reader went to.
//
// **The default arm is not retryable** (BP-048 decision 3). An answer we
// cannot classify, at a destination we do not own, must not be hammered
// three times; §9's "retry ×3" is for reasons a repeated attempt could
// clear, and an unrecognised one is not known to be among them.
//
// The archived plan is WO-236.
import type { FailureReason } from "../../types";
import type { TransportFailure, WordPressAnswer } from "./client";

/** No answer came back → the reason that says so.
 *
 *  `too_large` and `blocked_by_policy` are **not** retryable: a site whose
 *  answer exceeds the egress cap, or whose address the policy refuses,
 *  will do the same thing on every attempt, and three of them is three
 *  ways of finding out the same fact. */
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

/**
 * A status the site answered with → the reason it stands for.
 *
 * 401 and 403 are `credentials_expired`: the credential no longer opens
 * the door, the destination reads as **needs reconnecting**, and Reconnect
 * is the action that fixes it.
 *
 * 429 is the one retryable status — the site asked us to come back — and
 * 5xx is `destination_unavailable`, which is retryable for the same
 * reason. Everything else, 404 included, is the site refusing in a way no
 * repetition clears.
 */
export function reasonForStatus(status: number): FailureReason {
  if (status === 401 || status === 403) return "credentials_expired";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "destination_unavailable";
  return "destination_rejected";
}

/** Any answer at all → a reason. The two above, joined; used wherever a
 *  call's failure is just a failure. */
export function reasonFor(answer: WordPressAnswer): FailureReason {
  return answer.ok ? reasonForStatus(answer.status) : reasonForTransport(answer.transport);
}

/** Did the site answer with something a REST call is entitled to call a
 *  success? 2xx and a body — a 204 with nothing in it is not an answer to
 *  a call that asked for a resource back. */
export function succeeded(answer: WordPressAnswer): answer is { ok: true; status: number; body: unknown } {
  return answer.ok && answer.status >= 200 && answer.status < 300 && answer.body !== null;
}

/**
 * **ADR-086 Decision 5.** A create that came back with a post whose status
 * is not `publish` is `credentials_invalid`, and it is never
 * `credentials_expired`.
 *
 * WordPress's default role map gives `edit_posts` to Contributor and
 * `publish_posts` only from Author upward, so an application password from
 * a Contributor-level user can create a post and have WordPress quietly
 * hold it at `draft` whatever the request asked for. That is the one route
 * by which the ruling of 2026-09-01 could produce, unnoticed, exactly the
 * outcome it abolishes: a page ReachKit reports as published, sitting
 * invisible in a drafts folder.
 *
 * `credentials_invalid` is already the non-retryable reason meaning "this
 * credential will not do what we need and no repetition will change that",
 * which is exactly true here. `credentials_expired` reads as more accurate
 * and is wrong twice over: 401/403 already routes to it, and the health
 * check marks a destination `expired` from it — which would put this
 * occasion in the wrong one of §9's three states and hand the customer the
 * ordinary Reconnect, the one remedy REQ-060 criterion 7 says is never
 * offered here.
 */
export const NOT_PUBLISHED: FailureReason = "credentials_invalid";

/**
 * What a call about a post id ReachKit holds found.
 *
 * `gone` and `unreachable` are separate arms and stay separate: collapsing
 * them makes one of §9's four WordPress unpublish outcomes unreachable, and
 * a customer sent to delete a post that is not there was told the wrong
 * one. A 404 is the site saying the post is not in it; a transport failure
 * or a 5xx is the site not saying anything, and the post may well still be
 * live there.
 */
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
