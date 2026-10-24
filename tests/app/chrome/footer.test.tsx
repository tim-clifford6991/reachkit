// BUILD §3, §4.2, UI-SPEC 3a — the public footer (issue #351).
// tests/app/chrome/footer.test.tsx
//
// Ruling 3a of 2026-09-08 makes the footer part of the design rather than
// a proposal: "a minimal footer on every public page (brand, rights line,
// removal address, Product, Legal)", with the consequence stated beside it
// — "legal routes and the removal address reachable from every public
// page". Both halves are asserted here: what the footer holds, and that
// nothing decides whether it renders.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "@/app/(public)/_chrome/Footer";
import { COPY } from "@/lib/presentation/copy";

const LAYOUT = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/app/(public)/layout.tsx"),
  "utf8"
);

describe("ruling 3a — brand · rights · removal address · Product · Legal", () => {
  const html = renderToStaticMarkup(<Footer />);

  it("the brand and the two column headings render", () => {
    expect(html).toContain('href="/"');
    // Links underline on hover: daisyUI's own link-hover.
    expect(html).toContain("link link-hover");
    expect(html).toContain(COPY["chrome.footer.product"]);
    expect(html).toContain(COPY["chrome.footer.legal"]);
  });

  it("the three legal routes are reachable, and so is Pricing and Sign in", () => {
    for (const href of ["/privacy", "/terms", "/imprint", "/pricing", "/signin"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("the removal address renders, and it is the registry's one value", () => {
    // §4.2's way out, named where a person who never opened an email can
    // still find it. The sentence takes the address as a slot so
    // `removal.address` stays its one home (REQ-002 c1).
    expect(html).toContain(COPY["removal.address"]);
    expect(COPY["chrome.footer.opt-out"]).toContain("{address}");
  });

  it("the rights line is the owner's approved sentence (2026-09-10, #459)", () => {
    expect(COPY["chrome.footer.rights"]).toBe("© 2026 ReachKit. All rights reserved.");
  });

  it("board PubLanding: brand, then Product · Learn · Legal · Contact, then the rights and removal line", () => {
    const titles = [...html.matchAll(/<div class="footer-title[^"]*">([^<]*)<\/div>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Product", "Learn", "Legal", "Contact"]);
    expect(html.indexOf('href="/"')).toBeLessThan(html.indexOf(">Product<"));
    expect(html.lastIndexOf(COPY["chrome.footer.rights"])).toBeGreaterThan(html.indexOf(">Contact<"));
  });

  it("Learn opens with Free scans, then Compare, Free tools and Teardowns", () => {
    const learn = html.slice(html.indexOf(">Learn<"), html.indexOf(">Legal<"));
    const links = [...learn.matchAll(/<a class="link link-hover" href="([^"]*)">([^<]*)<\/a>/g)].map((m) => m[2]);
    expect(links).toEqual(["Free scans", "Compare", "Free tools", "Teardowns"]);
  });

  it("Contact is hello@reachkit.app, as a mail link", () => {
    const contact = html.slice(html.indexOf(">Contact<"));
    expect(contact).toContain('href="mailto:hello@reachkit.app"');
    expect(contact).toContain(">hello@reachkit.app<");
  });

  it("the group layout renders it on every public route, with nothing to decide", () => {
    // No prop, no pathname, no condition: a route that could turn the
    // footer off is a route that could drop the removal address.
    expect(LAYOUT).toContain("<Footer />");
    expect(LAYOUT).not.toMatch(/\{[^}]*&&\s*<Footer/);
  });
});
