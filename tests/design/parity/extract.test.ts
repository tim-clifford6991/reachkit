// A board's visible strings: its copy in, its annotations and design notes out.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { boardStrings } from "../../../scripts/design/parity.mjs";

const board = (name: string) => boardStrings(readFileSync(path.join(__dirname, "fixtures", `${name}.dc.html`), "utf8"));

describe("the strings a board draws", () => {
  it("reads a public board's copy, labels and closed details", () => {
    const strings = board("Board");
    expect(strings).toEqual(
      expect.arrayContaining([
        "One plan. Everything included.",
        "€49 a month, VAT included. Up to 7 pages a week, new or updated, live on your site.",
        "10 min of your time, once",
        "Switch to dark theme",
        "yourwebsite.com",
        "Scan my site for free",
        "Yes. Every page waits 24 hours before it goes live, and one click stops it.",
        "14-day money-back guarantee",
        "Cancel your contract",
      ]),
    );
  });

  it("drops style, script, svg, the head, [annotations] and the design note", () => {
    const text = [...board("Board"), ...board("AppBoard")].join("\n");
    for (const out of ["after launch gate", "Design note", "Harbor Plumbing", "script text", "moon icon", ".hero", "Pricing board", "doctype"]) {
      expect(text).not.toContain(out);
    }
  });

  it("drops the Other states strip of an app board and keeps the screen", () => {
    const strings = board("AppBoard");
    expect(strings).toEqual(expect.arrayContaining(["Technical issues", "3 pages have no title", "Publishing on"]));
    expect(strings.join("\n")).not.toMatch(/Other states|Nothing on your site needs fixing/);
  });
});
