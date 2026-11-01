// tests/presentation/copy/no-approval.test.ts — owner, 2026-10-08 (issue
// 1337): "remove the approve button entirely, autopilot only. this should
// also be reflected in notifications and messaging to ensure we never imply
// to the user that their approval is required. they can solely edit or stop
// the content".
//
// Every sentence the registry holds, in every language it holds one in, is
// read for wording that asks for an approval or puts a review before
// publishing. A key that matches fails unless it is on the allowlist below,
// with the reason it is not that wording.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { TRANSLATIONS } from "@/lib/presentation/copy/translated";

/** Approve and approval in any form, copilot, and the phrases that put the
 *  customer's review between a page and its publishing. German beside the
 *  English, because the registry speaks both. */
const ASKS_FOR_APPROVAL =
  /\bapprov\w*|\bcopilot\b|\b(?:your|in|for|awaiting|needs?) review\b|\breview (?:it|this page|the page) (?:before|first)\b|\bwait(?:s|ing)? for you\b|\bfreig\w+|\bgenehmig\w+|\bIhre Prüfung\b|\bwartet auf Sie\b/iu;

/** Keys whose sentence matches and is not that wording. One line each. */
const ALLOWED: Readonly<Record<string, string>> = {
  // A product name: the engine Microsoft Copilot, on the AI-readers table.
  "overview.blog.engine.copilot": "Microsoft Copilot is an AI engine's name",
  // The buyer's own question on the landing; its answer begins "No."
  "landing.faq.approve.q": "a buyer's question whose answer is no",
};

function offenders(entries: Iterable<readonly [string, string]>): string[] {
  const found: string[] = [];
  for (const [key, text] of entries) {
    if (ASKS_FOR_APPROVAL.test(text) && !(key in ALLOWED)) found.push(`${key}: ${text.slice(0, 140)}`);
  }
  return found;
}

describe("no customer sentence asks for an approval (issue 1337)", () => {
  it("in English", () => {
    expect(offenders(Object.entries(COPY as Record<string, string>))).toEqual([]);
  });

  it("in every translation", () => {
    const all: (readonly [string, string])[] = [];
    for (const partitions of Object.values(TRANSLATIONS)) {
      for (const partition of Object.values(partitions ?? {})) {
        for (const [key, text] of Object.entries(partition)) all.push([key, String(text)]);
      }
    }
    expect(offenders(all)).toEqual([]);
  });

  it("the allowlist names only keys that exist and still match", () => {
    for (const key of Object.keys(ALLOWED)) {
      const text = (COPY as Record<string, string>)[key];
      expect(text, key).toBeDefined();
      expect(ASKS_FOR_APPROVAL.test(text ?? ""), key).toBe(true);
    }
  });
});
