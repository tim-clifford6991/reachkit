// tests/app/legal/privacy-truth.test.tsx — the privacy notice says what the product does.
//
// Each claim is read off the rendered `/privacy` and held against the module
// that makes it true, so a fourth analytics event, a new provider or a
// longer-lived cookie fails here until the notice says so.
// The analytics seam parses the environment at import, so the bindings come first.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/(public)/privacy/page.tsx";
import TermsPage from "@/app/(public)/terms/page.tsx";
import ImprintPage from "@/app/(public)/imprint/page.tsx";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { DANGER_TICKET_TTL_MINUTES } from "@/lib/config/constants";

const html = renderToStaticMarkup(<PrivacyPage />);
const text = (s: string): string => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

/** One section of the notice, from its anchored heading to the next. */
function section(id: string): string {
  const start = html.indexOf(`<h2 id="${id}"`);
  expect(start, `no section #${id}`).toBeGreaterThan(-1);
  const end = html.indexOf("<h2 ", start + 1);
  return text(html.slice(start, end === -1 ? undefined : end));
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

describe("privacy — PostHog is a named service provider", () => {
  const posthog = (): string => {
    const providers = section("service-providers");
    return providers.slice(providers.indexOf("PostHog"));
  };

  it("names PostHog, and says the events are sent from our servers", () => {
    expect(posthog()).toMatch(/^PostHog — product analytics\./);
    expect(posthog()).toContain("Our servers send it");
    expect(posthog()).toContain("nothing of it runs in your browser");
  });

  it("counts exactly the events the analytics seam can send", () => {
    expect(posthog()).toContain(`send it ${NUMBER_WORDS[ANALYTICS_EVENTS.length]} events`);
  });
});

describe("privacy — international transfers", () => {

  it("is its own anchored section, listed under On this page", () => {
    expect(html).toContain('href="#international-transfers"');
    expect(html.indexOf('id="service-providers"')).toBeLessThan(html.indexOf('id="international-transfers"'));
  });

  it("gives every service provider a place and a safeguard, or says it is in the EU", () => {
    const providers = section("service-providers");
    const transfers = section("international-transfers");
    const named = [...providers.matchAll(/([A-Z][A-Za-z]+) — /g)].map((m) => m[1] ?? "");
    expect(named.length).toBeGreaterThanOrEqual(7);
    for (const name of named) {
      const line = transfers.slice(transfers.indexOf(name));
      expect(transfers, `${name} has no transfer line`).toContain(name);
      expect(line, name).toMatch(/^\S+ — United States\. (Standard Contractual Clauses|EU-U\.S\. Data Privacy Framework)|^\S+ is based in [A-Z][a-z]+, inside the EU\./);
    }
  });
});

describe("privacy — the cookies line matches what the product sets", () => {
  const cookies = (): string => section("cookies");

  it("names the sign-in cookie and the short-lived confirmation cookie, with its real lifetime", () => {
    expect(cookies()).toContain("one cookie, to keep you signed in");
    expect(cookies()).toContain(`second cookie for ${DANGER_TICKET_TTL_MINUTES} minutes`);
  });

  it("says analytics runs on the server, and no analytics or tracking cookies", () => {
    expect(cookies()).toContain("no analytics cookies, no advertising cookies and no cross-site trackers");
    expect(cookies()).toContain("Product analytics runs on our servers and stores nothing in your browser");
  });

  it("the rights line says Export your data", () => {
    expect(section("your-rights")).toContain("Settings lets you export your data and delete your account yourself");
    expect(html).not.toContain("export everything you have");
  });
});

describe("privacy — In short", () => {
  const summary = text(html.slice(html.indexOf('data-testid="legal-summary"'), html.indexOf('data-testid="legal-document"')));

  it("stands above the notice and says only what the notice below says", () => {
    expect(html).toContain('data-testid="legal-summary"');
    expect(summary).toContain("In short");
    expect(summary).toContain("No tracking or advertising cookies.");
    expect(summary).toContain("Export your data, or delete your account, from Settings.");
    expect(summary).toContain("A summary only. The full notice below is what applies.");
    // Two cookies exist, so the summary may not count one.
    expect(summary).not.toMatch(/\bOne cookie\b/);
  });

  it("is the privacy notice's alone", () => {
    for (const Page of [TermsPage, ImprintPage]) {
      expect(renderToStaticMarkup(<Page />)).not.toContain('data-testid="legal-summary"');
    }
  });
});
