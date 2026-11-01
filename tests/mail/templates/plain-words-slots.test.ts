// The figures the plain-words lines state come from the constants that run the product, and each new line sits on its own arm.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { PRICE_EUR_CENTS, RETENTION_MAIL, SETUP_MINUTES, WEEK_PLAN } = await import("../../../src/lib/config/constants");
const { composeAnyKind, composeRetentionPreview } = await import("../preview/kinds");
const { buildCancellation } = await import("../../../src/lib/mail/templates/cancellation");
const { buildDraftReady } = await import("../../../src/lib/mail/templates/draft-ready");
const { buildFirstPage } = await import("../../../src/lib/mail/templates/first-page");
const { renderBlocksText } = await import("../../../src/lib/mail/blocks/text");
const { COPY } = await import("../../../src/lib/presentation/copy");

describe("each changed slot is filled by its template", () => {
  it("the setup reminder states the setup time", async () => {
    expect((await composeAnyKind("setup-reminder")).text).toContain(`It takes about ${SETUP_MINUTES} minutes.`);
  });

  it("payment failed states the price, and win-back counts its days from the end of access", async () => {
    expect((await composeRetentionPreview("payment-failed")).text).toContain(`Your latest €${PRICE_EUR_CENTS / 100} payment`);
    expect((await composeRetentionPreview("win-back")).text).toContain(
      `Sent once, ${RETENTION_MAIL.winbackAfterAccessDays} days after your access ended.`
    );
  });

  it("the Monday mail states the week's pages, and the AI line no longer repeats the count", async () => {
    const { text } = await composeAnyKind("weekly");
    expect(text).toContain(`Up to ${WEEK_PLAN.days} pages a week`);
    expect(text).toContain(`${COPY["mail.weekly.ai.asked"]}\n`);
  });

  it("no subject carries a model-written title", () => {
    const page = { title: "A title the model wrote", markdown: "Body." };
    const telling = { kind: "interval", copy: "mail.draftReady.autopilotWindow", publishesAt: new Date(), destination: null, stopAction: { token: "t" } };
    const draft = buildDraftReady({ telling: telling as never, publishesAt: "Tomorrow 07:00", page });
    const first = buildFirstPage({ email: "a@b.c", pageTitle: page.title, markdown: "x", targetQuery: "q", volume: { kind: "unmeasured", reason: "not_attempted", at: new Date() } as never, pagesFound: 3 });
    for (const mail of [draft, first]) {
      expect(mail).not.toHaveProperty("subjectVars");
      expect(COPY[mail.subject]).not.toContain("{");
    }
  });
});

describe("the cancellation mail offers a way back only while access runs on", () => {
  it("the end-date arm closes on the resume line; the refund arm, which has ended, does not", () => {
    const said = (refunded: boolean) => renderBlocksText(buildCancellation({ accessEndsOn: "2026-11-30", refunded }).blocks).text;
    expect(said(false)).toContain(COPY["mail.cancellation.resume"]);
    expect(said(true)).not.toContain(COPY["mail.cancellation.resume"]);
  });
});
