import { expect, test } from "vitest";
import { Body } from "./route";

// ---------------------------------------------------------------------------
// `Body.target` — carries an ActionTarget (see lib/llm/types.ts) from a plan
// entry onto a tracked action. No live-DB route test exists here (this route
// only has a Supabase-backed POST/GET, no existing test harness), so this
// pins the schema boundary directly: a valid target round-trips through
// `.safeParse`, an invalid channel is rejected, and omitting `target`
// entirely still parses (backwards compatible with pre-target callers).
// ---------------------------------------------------------------------------

const baseBody = { title: "Post in r/SaaS", category: "outreach" as const };

test("Body accepts a well-formed target and parses it through unchanged", () => {
  const target = { channel: "community", label: "r/SaaS", url: "https://reddit.com/r/SaaS" };
  const parsed = Body.safeParse({ ...baseBody, target });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.target).toEqual(target);
});

test("Body accepts a target without a url (url is optional)", () => {
  const target = { channel: "creator", label: "Thomas Frank" };
  const parsed = Body.safeParse({ ...baseBody, target });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.target).toEqual(target);
});

test("Body rejects a channel outside the known ActionTargetChannel set", () => {
  const parsed = Body.safeParse({ ...baseBody, target: { channel: "blog", label: "Some Blog" } });
  expect(parsed.success).toBe(false);
});

test("Body rejects an empty target label", () => {
  const parsed = Body.safeParse({ ...baseBody, target: { channel: "x", label: "" } });
  expect(parsed.success).toBe(false);
});

test("Body still parses with no target at all (backwards compatible)", () => {
  const parsed = Body.safeParse(baseBody);
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.target).toBeUndefined();
});

test("Body accepts an explicit null target", () => {
  const parsed = Body.safeParse({ ...baseBody, target: null });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.target).toBeNull();
});
