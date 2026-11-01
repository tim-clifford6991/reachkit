// Every customer mail carries its own inbox line after the subject: hidden in the HTML body, absent from the plain-text twin.
import { beforeAll, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composeAnyKind, composeWaitingForAddress, EVERY_MAIL_KIND } = await import("../preview/kinds");
const { COPY } = await import("../../../src/lib/presentation/copy");
const account = await import("../../../src/lib/mail/templates/account");
const { buildSetupReminder } = await import("../../../src/lib/mail/templates/setup-reminder");
const { buildPublished } = await import("../../../src/lib/mail/templates/published");
type CopyKey = import("../../../src/lib/presentation/copy").CopyKey;
type MailKind = import("../../../src/lib/mail/kinds").MailKind;
type PublishedTelling = import("../../../src/lib/publish/verify/telling").PublishedTelling;

/** The kind's preview arm and its line. Nurture waits on the selling-copy review, and ops reaches only the owner. */
const PREHEADER: Readonly<Record<MailKind, CopyKey | null>> = {
  "magic-link": "mail.magicLink.preheader",
  report: "mail.report.preheader",
  "first-page": "mail.firstPage.preheader",
  "first-page-unavailable": "mail.firstPageUnavailable.preheader",
  nurture: null,
  "draft-ready": "mail.draftReady.preheader",
  published: "mail.published.preheader",
  weekly: "mail.weekly.preheader",
  "setup-reminder": "mail.setupReminder.preheader",
  account: "mail.account.chase.preheader",
  ops: null,
  "payment-failed": "mail.paymentFailed.preheader",
  cancellation: "mail.cancellation.preheader",
  "win-back": "mail.winback.preheader",
};

const HIDDEN = 'data-skip-in-text="true"';
const unescape = (html: string) => html.replace(/&#x27;/g, "'");

beforeAll(async () => {
  await composeAnyKind("magic-link");
}, 60_000);

describe("each kind renders its own preheader", () => {
  it("names every kind the register sends", () => {
    expect(Object.keys(PREHEADER).sort()).toEqual([...EVERY_MAIL_KIND].sort());
  });

  for (const kind of EVERY_MAIL_KIND) {
    const key = PREHEADER[kind];
    it(`${kind}: ${key === null ? "carries none" : "hidden in the HTML, not in the text twin"}`, async () => {
      const mail = await composeAnyKind(kind);
      if (key === null) {
        expect(mail.preheader).toBeNull();
        expect(mail.html).not.toContain(HIDDEN);
        return;
      }
      const line = COPY[key];
      expect(mail.preheader).toBe(line);
      expect(unescape(mail.html)).toContain(`${HIDDEN}>${line}`);
      // The inbox shows the preheader before anything in the card, so it comes before the brand head.
      expect(mail.html.indexOf(HIDDEN)).toBeLessThan(mail.html.indexOf("mark-96.png"));
      // The preview's title and hidden block are the HTML's only extra copies; the twin says it only where the body does.
      const count = (body: string) => body.split(line).length - 1;
      expect(count(unescape(mail.html))).toBe(count(mail.text) + 2);
    });
  }

  it("the page-ready mail for an unconnected address says how it goes live", async () => {
    const mail = await composeWaitingForAddress();
    expect(mail.preheader).toBe(COPY["mail.draftReady.waiting.preheader"]);
    expect(mail.subject).toBe(COPY["mail.draftReady.waiting.subject"]);
  });
});

describe("every arm of a kind names its preheader", () => {
  it("each account mail names its own, and the ones waiting on review name none", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    expect(
      [
        account.buildChaseWithLink({ href: "https://x/signin" }),
        account.buildChaseWithoutLink(),
        account.buildSecondPurchase(),
        account.buildAddressMoved(),
        account.buildHostingEnd({ occasion: "access_ended", stopsOn: "2026-10-31" }),
        account.buildHostingEnd({ occasion: "seven_days", stopsOn: "2026-10-31" }),
        account.buildDestinationBroken({ held: 2, href: "https://x/app", at }),
        account.buildRenewalRefunded({ amount: "€49", next: null }),
        account.buildAccountDeleted({ stillLive: 1, leftInWordPress: {} }),
      ].map((mail) => mail.preheader ?? null)
    ).toEqual([
      "mail.account.chase.preheader",
      "mail.account.chase.preheader",
      "mail.account.second_purchase.preheader",
      "mail.account.address_moved.preheader",
      "mail.account.hosting_end.preheader",
      "mail.account.hosting_end.preheader",
      "mail.account.destinationBroken.preheader",
      null,
      null,
    ]);
  });

  it("a founder past setup is told the step left, not to finish setup", () => {
    const mail = buildSetupReminder({ signInHref: "https://x/signin", connect: { written: true, provider: null } });
    expect(mail.preheader).toBe("mail.setupReminder.connectAny");
  });

  it("the published mail's subject follows the recorded outcome, under one preheader", () => {
    const checkedAt = new Date("2026-10-01T12:00:00Z");
    const telling = (result: PublishedTelling["result"]): PublishedTelling =>
      ({ publicationId: "p", siteId: "s", liveUrl: "https://x/p", result, failed: [], siteCondition: null, copy: "mail.published.not_found" }) as PublishedTelling;
    const outcomes = [
      telling({ outcome: "page_not_found", status: 404, checkedAt }),
      telling({ outcome: "could_not_confirm", why: "unreachable", checkedAt }),
    ].map((t) => buildPublished({ telling: t, timeZone: "UTC" }));
    expect(outcomes.map((mail) => [mail.subject, mail.preheader])).toEqual([
      ["mail.published.subject.not_found", "mail.published.preheader"],
      ["mail.published.subject.not_confirmed", "mail.published.preheader"],
    ]);
  });
});
