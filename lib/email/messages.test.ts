/**
 * Email render guard (intake 2026-07-26-email-system, acceptance criterion 4).
 * Every message type must render clean HTML through the branded shell + carry a
 * plain-text alternative. Catches the JSX-garbage class (undefined/NaN/[object
 * Object]) at the email layer, same as the report rubric's R1.
 */
import { describe, it, expect } from "vitest";
import { ALL_SAMPLE_EMAILS } from "./messages";

const GARBAGE = ["undefined", "NaN", "[object Object]", "null/100"];

describe("branded email messages", () => {
  for (const [type, build] of Object.entries(ALL_SAMPLE_EMAILS)) {
    describe(type, () => {
      const email = build();

      it("has a non-empty subject, html, and text alternative", () => {
        expect(email.subject.length).toBeGreaterThan(0);
        expect(email.html.length).toBeGreaterThan(0);
        expect(email.text.trim().length).toBeGreaterThan(0);
      });

      it("renders no garbage tokens", () => {
        for (const g of GARBAGE) {
          expect(email.html, `${type} html contains "${g}"`).not.toContain(g);
        }
      });

      it("routes through the branded shell (logo + footer + preheader)", () => {
        expect(email.html).toContain("reachkit-icon-512.png"); // logo
        expect(email.html).toContain("Manage preferences"); // footer
        expect(email.html).toContain("<!doctype html>"); // full shell
        expect(email.html).toContain("#6E56F7"); // brand violet present
      });

      it("text alternative ends with the shared footer", () => {
        expect(email.text).toContain("Discoverability, measured.");
      });
    });
  }

  it("covers every declared message type (the set only grows)", () => {
    expect(Object.keys(ALL_SAMPLE_EMAILS).sort()).toEqual([
      "daily-focus", "login-link", "scan-ready", "score-alert",
      "subscription-canceled", "weekly-digest", "welcome",
    ]);
  });
});
