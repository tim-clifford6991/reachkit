// SPEC §8 — a new site's first Monday mail: no zero stands for a step nobody measured, and the connect notice leads.
import path from "node:path";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composeWeeklyFirst } = await import("./kinds");
const { copy, COPY } = await import("../../../src/lib/presentation/copy");
const { render } = await import("react-email");

const mail = await composeWeeklyFirst();
/** Both bodies as a reader sees them: the HTML without its tags or the inbox's hidden preheader. */
const bodies = {
  text: mail.text,
  html: mail.html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").split(mail.preheader!).join(""),
};
const GOOGLE_STEPS = ["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"] as const;
const NOT_CHECKED = COPY["mail.weekly.number.unmeasured"];

describe("the first Monday mail of a new site", () => {
  it("composes for week 1 of a hosted site still waiting for its address", () => {
    expect(mail.subject).toBe(COPY["mail.weekly.subject"]);
    for (const body of Object.values(bodies)) {
      expect(body).toContain(copy("mail.weekly.hi", { name: "Dana", week: "1", business: "harborplumbing.example" }));
      expect(body).toContain(COPY["mail.weekly.setAside.one.unreplaced"]);
      expect(body).toContain(copy("mail.weekly.needsYou", { page: "emergency plumber austin" }));
    }
  });

  it("states every unmeasured Google and AI step as not yet measured, never as a zero", () => {
    for (const [name, body] of Object.entries(bodies)) {
      expect(body.split(NOT_CHECKED).length - 1, name).toBe(GOOGLE_STEPS.length);
      expect(body, name).toContain(COPY["mail.weekly.ai.early"]);
      expect(body, name).not.toContain(copy("mail.weekly.google.of", { n: "0" }));
      expect(body, name).not.toMatch(/\b0 pages live\b/i);
    }
    for (const step of GOOGLE_STEPS) expect(mail.text).toContain(`${COPY[step]}: ${NOT_CHECKED}`);
    const googleToAi = mail.text.slice(mail.text.indexOf(COPY["mail.weekly.google.title"]), mail.text.indexOf(COPY["mail.weekly.verdicts"]));
    expect(googleToAi).not.toMatch(/\b0\b/);
  });

  it("leads with the connect notice, straight after the greeting", () => {
    const greeting = copy("mail.weekly.hi", { name: "Dana", week: "1", business: "harborplumbing.example" });
    const connect = copy("mail.weekly.connect", { host: "blog.harborplumbing.example" });
    for (const [name, body] of Object.entries(bodies)) {
      expect(body.indexOf(greeting), name).toBeGreaterThan(-1);
      const from = body.indexOf(greeting) + greeting.length;
      const to = body.indexOf(connect);
      expect(to, name).toBeGreaterThanOrEqual(from);
      expect(body.slice(from, to).trim(), name).toBe("");
    }
  });

  it("is one of the weekly states the preview server renders", async () => {
    const file = path.resolve(__dirname, "../../../emails/variants/weekly-first.tsx");
    const template = (await import(file)) as { default: () => unknown };
    const html = await render(createElement(template.default as never));
    expect(html).toContain("blog.harborplumbing.example");
    expect(html).toContain("week 1");
  });
});
