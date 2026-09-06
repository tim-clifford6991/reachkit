// tests/account/provisioning/ports.test.ts — BUILD §13, issue #33
//
// The two ports this module reaches the rest of the product through, and
// the one property that matters about both: with nothing registered they
// say so, and they never invent an answer.
//
// The sign-in link's issuer is issue #35's (`auth_links`, `issueLink`); the
// deep pass's queue is `src/jobs/**`'s, which `src/lib/**` may not import
// (ARCHITECTURE rule 2). Neither may be faked, because a fabricated link is
// a dead link in a customer's inbox and a fabricated queue is a deep pass
// nobody runs.
import { afterEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { issueSignInLink, registerSignInLinkIssuer } = await import(
  "@/lib/account/provisioning/sign-in-link"
);
const { queueDeepPass, registerDeepPassQueue } = await import(
  "@/lib/account/provisioning/deep-pass"
);

afterEach(() => {
  registerSignInLinkIssuer(null);
  registerDeepPassQueue(null);
});

describe("the sign-in link's issuer fails closed", () => {
  it("with none registered it refuses, and returns no URL of any kind", async () => {
    const answer = await issueSignInLink({ userId: "user-1", to: "founder@acme.example" });
    expect(answer).toEqual({ issued: false, reason: "not_wired" });
    expect(JSON.stringify(answer)).not.toContain("http");
  });

  it("a registered issuer is asked for purpose 'sign_in' and nothing else", async () => {
    const seen: unknown[] = [];
    registerSignInLinkIssuer(async (a) => {
      seen.push(a);
      return { issued: true, url: "https://reachkit.example/signin?t=t", expiresAt: new Date(0) };
    });
    await issueSignInLink({ userId: "user-1", to: "founder@acme.example" });
    expect(seen[0]).toEqual({ userId: "user-1", to: "founder@acme.example", purpose: "sign_in" });
  });

  it("null restores the refusal — an unregistered port is never left half-wired", async () => {
    registerSignInLinkIssuer(async () => ({
      issued: true,
      url: "https://reachkit.example/signin?t=t",
      expiresAt: new Date(0),
    }));
    registerSignInLinkIssuer(null);
    await expect(issueSignInLink({ userId: "user-1", to: "a@b.example" })).resolves.toEqual({
      issued: false,
      reason: "not_wired",
    });
  });
});

describe("the deep pass queue reports what happened and throws nothing", () => {
  it("with none registered it says so", async () => {
    await expect(queueDeepPass({ siteId: "site-1", domain: "acme.example" })).resolves.toBe(
      "not_wired"
    );
  });

  it("a queue that accepts the request answers queued", async () => {
    registerDeepPassQueue(async () => {});
    await expect(queueDeepPass({ siteId: "site-1", domain: "acme.example" })).resolves.toBe(
      "queued"
    );
  });

  it("a queue that throws answers failed, never propagates — an account must not fail to open because a queue was unreachable", async () => {
    registerDeepPassQueue(async () => {
      throw new Error("queue is down");
    });
    await expect(queueDeepPass({ siteId: "site-1", domain: "acme.example" })).resolves.toBe(
      "failed"
    );
  });

  it("the request carries the site and the domain, and nothing about the buyer", async () => {
    const seen: unknown[] = [];
    registerDeepPassQueue(async (request) => void seen.push(request));
    await queueDeepPass({ siteId: "site-1", domain: "acme.example" });
    expect(Object.keys(seen[0] as object).sort()).toEqual(["domain", "siteId"]);
  });
});
