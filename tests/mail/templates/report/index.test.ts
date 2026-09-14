// SPEC §8, #638 — the free-report mail: verdict, next step, one action; an unmeasured score names no factor.
import { expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";
applyEnvFixture();
const { buildReport } = await import("../../../../src/lib/mail/templates/report");
const keys = (limiting: "presence" | null) => buildReport({ facts: { domain: "a.com", score: "62", band: "Hard to find", aiAnswers: "0 of 9", googleSearch: "0 of 12", limiting }, href: "https://x/scan/a.com", removalAddress: "r@x" }).blocks.map((b) => ("text" in b ? b.text : b.block));
it("states the verdict, then the next step, then its one action", () => {
  expect([keys("presence"), keys(null)]).toEqual([["mail.report.heading", "mail.report.body", "facts", "verdict.limiting.presence", "mail.report.next", "action"], ["mail.report.heading", "mail.report.body", "facts", "mail.report.next", "action"]]);
});
