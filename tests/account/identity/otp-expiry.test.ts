// tests/account/identity/otp-expiry.test.ts — SPEC §3 "Link lasts 24 h"
// (issue 718).
//
// A sign-in link's lifetime is Supabase's, not this process's: `verifyOtp`
// refuses a token older than `[auth.email] otp_expiry`, and that refusal is
// what lands its holder on `/signin?link=dead` (`links.test.ts` covers the
// redemption). So the one place 24 h is enforced is that setting, and it
// has to agree with the pin the product states the lifetime with.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNIN_LINK_TTL_H } from "../../../src/lib/config/constants";

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
