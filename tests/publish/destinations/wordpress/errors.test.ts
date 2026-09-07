// tests/publish/destinations/wordpress/errors.test.ts — the one place a
// WordPress payload stops, and the two negatives that hold the ruling.
//
// Two rows here are the whole reason the file exists, and neither is a
// happy path:
//
//  1. **A create that came back not published is `credentials_invalid` and
//     never `credentials_expired`** (ADR-086 Decision 5). Mapping it to
//     `credentials_expired` reads as more accurate, passes every other row
//     in this file, and silently moves the destination into the state that
//     offers the customer the one remedy that cannot work.
//  2. **`already_gone` and `unreachable` are two answers.** Collapsing
//     them makes one of §9's four WordPress unpublish outcomes
//     unreachable, which is a change to what the product promises.
//
// The archived plan is WO-236.
import { describe, expect, it } from "vitest";
// The env fixture, applied at this module's own load: `attempt/` reaches
// `@/lib/db`, which validates its bindings once, at import.
import "../../harness";
import { RETRYABLE } from "@/lib/publish/attempt";
import {
  NOT_PUBLISHED,
  classifyPostAnswer,
  reasonFor,
  reasonForStatus,
  reasonForTransport,
  succeeded,
} from "@/lib/publish/destinations/wordpress/errors";
import type { WordPressAnswer } from "@/lib/publish/destinations/wordpress/client";

const answered = (status: number, body: unknown = {}): WordPressAnswer => ({ ok: true, status, body });
const silent = (transport: "dns" | "refused" | "timeout" | "too_large" | "blocked_by_policy"): WordPressAnswer => ({
  ok: false,
  transport,
});

const retryable = (reason: string) => RETRYABLE.includes(reason as (typeof RETRYABLE)[number]);

describe("a status the site answered with maps to the reason it stands for", () => {
  it.each([
    [401, "credentials_expired", false],
    [403, "credentials_expired", false],
    [404, "destination_rejected", false],
    [400, "destination_rejected", false],
    [418, "destination_rejected", false],
    [429, "rate_limited", true],
    [500, "destination_unavailable", true],
    [503, "destination_unavailable", true],
  ])("%i is %s (retryable: %s)", (status, reason, isRetryable) => {
    expect(reasonForStatus(status)).toBe(reason);
    expect(retryable(reason as string)).toBe(isRetryable);
  });

  it("an unrecognised status is not retryable — an answer we cannot classify is not hammered three times", () => {
    expect(retryable(reasonForStatus(299))).toBe(false);
    expect(retryable(reasonForStatus(451))).toBe(false);
  });
});

describe("no answer at all maps to why none came", () => {
  it.each([
    ["dns", "network", true],
    ["refused", "network", true],
    ["timeout", "timeout", true],
    ["too_large", "destination_rejected", false],
    ["blocked_by_policy", "destination_rejected", false],
  ] as const)("%s is %s (retryable: %s)", (transport, reason, isRetryable) => {
    expect(reasonForTransport(transport)).toBe(reason);
    expect(retryable(reason)).toBe(isRetryable);
  });

  it("reasonFor takes either shape", () => {
    expect(reasonFor(silent("timeout"))).toBe("timeout");
    expect(reasonFor(answered(429))).toBe("rate_limited");
  });
});

describe("ADR-086 Decision 5 — a create that came back not published", () => {
  it("is credentials_invalid, and no repeated attempt could clear it", () => {
    expect(NOT_PUBLISHED).toBe("credentials_invalid");
    expect(retryable(NOT_PUBLISHED)).toBe(false);
  });

  it("**and is never credentials_expired** — the mapping that would hand the customer the one remedy that cannot work", () => {
    expect(NOT_PUBLISHED).not.toBe("credentials_expired");
  });
});

describe("a call about a post id we hold — the two arms that must not merge", () => {
  it("a 404 for that post is `gone`: nothing is theirs to remove", () => {
    expect(classifyPostAnswer(answered(404))).toEqual({ kind: "gone" });
  });

  it("a transport failure at the site is `unreachable`: the post may still be live there", () => {
    for (const transport of ["dns", "refused", "timeout"] as const) {
      expect(classifyPostAnswer(silent(transport))).toEqual({ kind: "unreachable" });
    }
  });

  it("a 5xx is `unreachable` too — the site did not say the post is gone, it said nothing about it", () => {
    expect(classifyPostAnswer(answered(500))).toEqual({ kind: "unreachable" });
  });

  it("the two are distinct, and a reader can tell which happened", () => {
    expect(classifyPostAnswer(answered(404))).not.toEqual(classifyPostAnswer(silent("dns")));
  });

  it("a 2xx with a post is the post", () => {
    expect(classifyPostAnswer(answered(200, { id: 9 }))).toEqual({ kind: "ok", body: { id: 9 } });
  });

  it("anything else is a failure carrying its reason", () => {
    expect(classifyPostAnswer(answered(401))).toEqual({ kind: "failed", reason: "credentials_expired" });
  });
});

describe("no vendor payload reaches any returned value", () => {
  it("a body carrying a credential-shaped string is discarded rather than propagated", () => {
    const nasty = answered(500, { message: "auth failed for user reachkit-bot with password hunter2" });
    const classified = classifyPostAnswer(nasty);
    expect(JSON.stringify(classified)).not.toContain("hunter2");
    expect(reasonFor(nasty)).toBe("destination_unavailable");
  });

  it("every mapped reason is a token from the closed union and never a string the site wrote", () => {
    const closed = [
      "network",
      "timeout",
      "destination_unavailable",
      "rate_limited",
      "credentials_expired",
      "credentials_invalid",
      "dns_not_pointed",
      "destination_rejected",
      "no_destination",
    ];
    for (const status of [200, 400, 401, 403, 404, 418, 429, 500, 503]) {
      expect(closed).toContain(reasonForStatus(status));
    }
  });
});

describe("`succeeded` is 2xx with something in it", () => {
  it("a 204 with nothing is not an answer to a call that asked for a resource", () => {
    expect(succeeded(answered(204, null))).toBe(false);
    expect(succeeded(answered(201, { id: 1 }))).toBe(true);
    expect(succeeded(answered(404, { code: "rest_post_invalid_id" }))).toBe(false);
  });
});
