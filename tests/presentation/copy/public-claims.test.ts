// tests/presentation/copy/public-claims.test.ts — issue 1393 (owner,
// 2026-10-10): each thing the offer, the landing, the pricing page and the
// report's offer promise is held against the constant or the code path that
// makes it true, so a sentence cannot outrun the product again.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { PRICE_EUR_CENTS } from "@/lib/config/constants/costs";
import { CONTENT_MIX, HOSTED_RETENTION_DAYS, HOSTING_END_REMINDER_DAYS, PACE, RATE_LIMITS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { COPY, COPY_META, copy, type CopyKey } from "@/lib/presentation/copy";
import { TRANSLATIONS } from "@/lib/presentation/copy/translated";
import { fixPageReadiness } from "@/lib/opportunities/fix-page";
import { DOER_OF } from "@/lib/site-issues/types";

const text = (key: CopyKey): string => (COPY as Record<string, string>)[key] ?? "";

/** The mails that state the pace say the A1 week, which retired the 2026-10-10 "every day". */
const MAIL_PACE: readonly CopyKey[] = ["mail.nurture.body.1", "mail.winback.line"];

/** Every public sentence that states the pace says the owner's A1 week. */
const WEEK_PACE: readonly CopyKey[] = [
  "offer.cadence.page",
  "pricing.subline",
  "meta.landing.description",
  "meta.pricing.description",
];

/** The short forms of the same promise: a heading or a plan's name. */
const WEEK_PACE_SHORT: readonly CopyKey[] = ["plan.single"];

/** The landing states its pace as the owner's A1 sentence (2026-10-19). */
const LANDING_PACE: readonly CopyKey[] = [
  "landing.pace",
  "landing.plan.pages",
  "landing.step.2.body",
  ...WEEK_PACE,
  ...WEEK_PACE_SHORT,
];

/** The sentences that say how long a page waits before it goes live. */
const WINDOW: readonly { key: CopyKey; slot: string }[] = [
  { key: "offer.pricing.veto", slot: "hours" },
];

describe("a page every day, new or updated (owner, 2026-10-10)", () => {
  it("the product publishes at most one page a day, which is what “every day” counts", () => {
    expect(RATE_LIMITS.publishesPerDay).toBe(1);
  });

  it("fewer new pages a week than days, so some days are updates and the sentence must say so", () => {
    expect(PACE.NEW_PAGES_PER_WEEK).toBeLessThan(CONTENT_MIX.WINDOW_DAYS);
    for (const key of MAIL_PACE) expect(text(key), key).toMatch(/new or updated/);
  });

  it("no sentence, long or short, promises a new page each day or counts pages by the day", () => {
    const perDay = /\bnew page[^.]{0,24}(?:every|each|a|per) day\b|\b(?:one|1)(?: new)? page a day\b|(?<!at most )\bone a day\b/i;
    const offenders = Object.entries(COPY as Record<string, string>)
      .filter(([key]) => !key.startsWith("method."))
      .filter(([, value]) => perDay.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it("the German sentences make the same promise", () => {
    const de = Object.assign({}, ...Object.values(TRANSLATIONS.de ?? {})) as Record<string, string>;
    const offenders = Object.entries(de)
      .filter(([key]) => !key.startsWith("method."))
      .filter(([, value]) => /Seite pro Tag|neue Seite geschrieben|Eine pro Tag/i.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});

describe("up to a week's pages, new or updated (owner, A1, 2026-10-19)", () => {
  it("a week cannot hold more pages than one a day for seven days, so “up to” is true", () => {
    expect(RATE_LIMITS.publishesPerDay * CONTENT_MIX.WINDOW_DAYS).toBeLessThanOrEqual(WEEK_PLAN.days);
  });

  it("each landing sentence takes the number from the slot and says new or updated", () => {
    for (const key of LANDING_PACE) {
      expect(Object.keys(COPY_META[key].slots), key).toContain("weekPages");
      expect(text(key), key).not.toMatch(/\b\d+ pages?\b|every day/);
    }
    for (const key of [...WEEK_PACE, ...WEEK_PACE_SHORT]) {
      expect(copy(key, { weekPages: WEEK_PLAN.days }), key).toMatch(new RegExp(`up to ${WEEK_PLAN.days} pages a week`, "i"));
    }
    for (const key of WEEK_PACE) expect(text(key), key).toMatch(/new or updated/);
    for (const key of MAIL_PACE) {
      expect(Object.keys(COPY_META[key].slots), key).toContain("weekPages");
      expect(copy(key, { domain: "example.com", weekPages: WEEK_PLAN.days }), key).toMatch(new RegExp(`up to ${WEEK_PLAN.days} pages a week, new or updated`, "i"));
      expect(text(key), key).not.toMatch(/every day/);
    }
    // The report's closing heading leaves the count to the offer's rows under it.
    expect(text("offer.close.heading")).not.toMatch(/every day|a day\b/i);
    expect(copy("landing.pace", { weekPages: WEEK_PLAN.days })).toBe(
      `Up to ${WEEK_PLAN.days} pages a week, new or updated. Never filler.`
    );
  });

  it("no mail says a page every day", () => {
    const offenders = Object.entries(COPY as Record<string, string>)
      .filter(([key, value]) => key.startsWith("mail.") && /a page every day|every day, new/i.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});

describe("the pricing snippet states the price as /pricing does", () => {
  it("names the plan's price and the page's tax wording", () => {
    const tax = text("price.interval").split(" · ").at(-1) ?? "";
    expect(tax).toBe("tax included");
    expect(text("meta.pricing.description")).toContain(`€${PRICE_EUR_CENTS / 100} a month, ${tax}`);
  });
});

describe("hosted pages after access ends (ruling D5)", () => {
  it("the landing's answer says how long they stay, from the pin, and that we email a week before", () => {
    expect(Object.keys(COPY_META["landing.faq.stop.a"].slots)).toContain("days");
    expect(text("landing.faq.stop.a")).not.toMatch(/\d/);
    expect(copy("landing.faq.stop.a", { days: HOSTED_RETENTION_DAYS })).toContain(`stay live for ${HOSTED_RETENTION_DAYS} days after your access ends`);
    expect(HOSTING_END_REMINDER_DAYS).toBe(7);
    expect(text("landing.faq.stop.a")).toContain("we email you a week before they stop");
  });
});

describe("the cancel answer leaves when access ends to the Terms (ruling R22)", () => {
  it("promises no month-end access a refund cancel would break, names no refund, and points at a Terms section that says it", () => {
    const answer = text("landing.faq.stop.a");
    expect(answer).not.toMatch(/keep access until the end/i);
    expect(answer).not.toMatch(/refund|money-back/i);
    expect(answer).toContain("Section four of our Terms says when your access ends.");
    const section4 = text("legal.terms.body").split("\n## ").find((s) => s.startsWith("4. "));
    expect(section4).toMatch(/^4\. Price, billing and cancellation/);
    expect(section4).toContain("Otherwise your access continues to the end of the period you have paid for");
  });
});

describe("the time to stop a page is the pin, never a typed number", () => {
  it("each sentence takes the hours through a slot", () => {
    for (const { key, slot } of WINDOW) {
      expect(Object.keys(COPY_META[key].slots), key).toContain(slot);
      expect(text(key), key).not.toMatch(/\d/);
      expect(copy(key, { [slot]: String(VETO.defaultHours) }), key).toContain(String(VETO.defaultHours));
    }
  });

  it("no cadence sentence types a number of hours", () => {
    for (const key of [...MAIL_PACE, ...WEEK_PACE, ...WEEK_PACE_SHORT, "offer.close.heading" as const]) expect(text(key), key).not.toMatch(/\d+ ?(?:hours|h)\b/);
  });
});

describe("“ReachKit rewrites” is said only with where it is true", () => {
  it("a page's title or description is rewritten on a WordPress destination and nowhere else", () => {
    const fix = { pageUrl: "https://example.com/pricing", issues: ["page_titles", "meta_descriptions"] as const };
    expect(fixPageReadiness(fix, { kind: "wordpress", host: "example.com" })).toBeNull();
    expect(fixPageReadiness(fix, { kind: "none" })).toBe("destination_cannot_address");
  });

  it("so every sentence that says ReachKit rewrites names WordPress", () => {
    const rewrites = Object.entries(COPY as Record<string, string>).filter(([, value]) => /\bReachKit rewrites\b/.test(value));
    expect(rewrites.length).toBeGreaterThan(0);
    for (const [key, value] of rewrites) expect(value, key).toContain("WordPress");
  });

  it("and the two checks the report gives that doer are the two WordPress has a field for", () => {
    const given = Object.entries(DOER_OF)
      .filter(([, doer]) => doer === "reachkit_rewrites")
      .map(([check]) => check);
    for (const check of given) {
      expect(fixPageReadiness({ pageUrl: "https://example.com/a", issues: [check as never] }, { kind: "wordpress", host: "example.com" }), check).toBeNull();
    }
  });
});

describe("a page set aside asks the customer for nothing", () => {
  it("the note and the day's line say what happened and name no task", () => {
    for (const key of ["draft.adds.ask"] satisfies CopyKey[]) {
      expect(text(key), key).toMatch(/next topic/);
      expect(text(key), key).not.toMatch(/\b(?:tell us|add (?:a|it|what)|write (?:it|the page) again)\b/i);
    }
  });
});
