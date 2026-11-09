// tests/account/provisioning/ports.test.ts — BUILD §13, issue #33
//
// The port this module reaches the sign-in link through, and the one
// property that matters about it: with nothing registered it says so, and
// it never invents an answer — a fabricated link is a dead link in a
// customer's inbox.
import { afterEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { issueSignInLink, registerSignInLinkIssuer } = await import(
  "@/lib/account/provisioning/sign-in-link"
);

afterEach(() => {
  registerSignInLinkIssuer(null);
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
