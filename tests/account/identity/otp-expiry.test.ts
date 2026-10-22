// tests/account/identity/otp-expiry.test.ts — SPEC §3 "Link lasts 24 h"
// (issue 718).
//
// A sign-in link's lifetime is Supabase's, not this process's: `verifyOtp`
// refuses a token older than `[auth.email] otp_expiry`, and that refusal is
// what lands its holder on `/signin?link=dead` (`links.test.ts` covers the
// redemption). So the one place 24 h is enforced is that setting, and it
// has to agree with the pin the product states the lifetime with.
//
// Issue 1019: and so does every sentence that tells a customer the lifetime.
// The sign-in mail said "15 minutes" for two weeks while the link lived 24 h,
// because the sentence carried its own number and nothing compared it with
// this one. `SIGNIN_LINK_TTL_H` is the one number; the setting and both
// sentences are held to it here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNIN_LINK_TTL_H } from "../../../src/lib/config/constants";
import { COPY } from "../../../src/lib/presentation/copy";

const CONFIG = readFileSync(path.resolve(import.meta.dirname, "../../../supabase/config.toml"), "utf8");

/** The value of `key` inside `[section]`, read line by line — the file is
 *  flat TOML and a parser dependency is not worth one number. */
function tomlValue(section: string, key: string): string | undefined {
  let inSection = false;
  for (const raw of CONFIG.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) inSection = line === `[${section}]`;
    else if (inSection && line.startsWith(`${key} `)) return line.split("=")[1]?.trim();
  }
  return undefined;
}

describe("the sign-in link's lifetime is 24 h, in the one place Supabase enforces it", () => {
  it("`[auth.email] otp_expiry` is SIGNIN_LINK_TTL_H in seconds", () => {
    expect(SIGNIN_LINK_TTL_H).toBe(24);
    expect(Number(tomlValue("auth.email", "otp_expiry"))).toBe(SIGNIN_LINK_TTL_H * 60 * 60);
  });
});

/** Every span of time a sentence states, as it states it: "24 hours",
 *  "15 minutes", "a day" is not one of these and would need its own case. */
function durationsIn(sentence: string): string[] {
  return [...sentence.matchAll(/\b(\d+)\s*(minutes?|hours?|days?|h)\b/gi)].map((m) => `${m[1]} ${m[2]!.toLowerCase()}`);
}

describe("#1019 — what the customer is told is the lifetime Supabase enforces", () => {
  const hours = `${SIGNIN_LINK_TTL_H} hours`;

  it("the sign-in mail states SIGNIN_LINK_TTL_H hours, and no other span", () => {
    expect(durationsIn(COPY["mail.magicLink.body"])).toEqual([hours]);
  });

  it("the screen that sends it states the same span, and no other", () => {
    expect(durationsIn(COPY["signin.sent.window"])).toEqual([hours]);
    const spans = Object.entries(COPY)
      .filter(([key]) => key.startsWith("signin."))
      .flatMap(([, sentence]) => durationsIn(sentence));
    expect(new Set(spans)).toEqual(new Set([hours]));
  });
});
