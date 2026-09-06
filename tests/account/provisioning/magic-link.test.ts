// tests/account/provisioning/magic-link.test.ts — issue #19
//
// `src/lib/account/provisioning/magic-link.ts` is a declared seam with no
// body: the identity half is issue #35. The one promise testable today is
// the one REQ-098 criterion 3 makes it matter — it never answers
// `{ sent: true }`, because a screen told a link was sent when no mail left
// the process is the single worst answer this seam could give.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  requestMagicLink,
  MagicLinkNotImplementedError,
} from "@/lib/account/provisioning/magic-link";

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/provisioning/magic-link.ts"),
  "utf8"
);

describe("the seam refuses rather than answers, until issue #35 lands", () => {
  it("requestMagicLink rejects with MagicLinkNotImplementedError, naming the issue that owes the body", async () => {
    await expect(requestMagicLink("someone@example.com")).rejects.toBeInstanceOf(
      MagicLinkNotImplementedError
    );
    await expect(requestMagicLink("someone@example.com")).rejects.toThrow("issue #35");
  });

  it("no code path in the file returns `sent: true`", () => {
    expect(SOURCE).not.toContain("sent: true,");
    expect(SOURCE).not.toMatch(/return\s*\{\s*sent:\s*true/);
  });

  it("the address it is given is discarded, never read: the file holds no lookup, no store and no log", () => {
    expect(SOURCE).not.toMatch(/console\./);
    expect(SOURCE).not.toMatch(/\bdb\(|dbAdmin\(/);
    expect(SOURCE).not.toMatch(/sendEmail\(/);
  });
});

describe("BP-032's three branches are declared, so the screen can be written against them", () => {
  it("the answer type names both lineKeys the sign-in screen speaks", () => {
    expect(SOURCE).toContain('lineKey: "signin.payment_held"');
    expect(SOURCE).toContain('lineKey: "signin.no_account"');
  });
});
