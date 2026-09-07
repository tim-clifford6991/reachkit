// tests/mail/draft-ready/send.test.ts — the occasion of the `draft-ready`
// mail (#174), and the order that carries §9's promise.
//
// The discriminating row is the **order**: `recordTold` must be written
// only after the send seam accepted the mail. Recording first and sending
// after is the convenient implementation, it passes every happy-path
// assertion in this file, and it is the one that lets a page publish in
// silence — the guard reads `drafts.told`, so a page marked told by a mail
// that never left is a page §9 will publish without the customer having
// been told anything.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

interface SentMail {
  kind: string;
  to: string;
  userId?: string;
  subject: string;
  suppressible?: false;
  blocks: readonly { block: string; text?: string; label?: string; href?: string; vars?: Record<string, string> }[];
}

let sent: SentMail[] = [];
let sendAnswer: { sent: true; id: string } | { sent: false; reason: string } = {
  sent: true,
  id: "vendor-1",
};

vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: SentMail) => {
    sent.push(m);
    return sendAnswer;
  },
}));

/** §7's stored evidence for the page, as `explainChoice` reads it back.
 *  Doubled at that seam and not below it: this suite is about what the
 *  mail does with the evidence, and #183's ruling is that it **reads** the
 *  stored evidence rather than measuring anything. */
const choice = vi.hoisted(() => ({
  answer: {
    opportunityId: "opp-1",
    type: "write",
    family: "write",
    fitBand: "winnable",
    acceptance: { form: "top20", query: "how long does a slate roof last" },
    evidence: {
      family: "write",
      query: "how long does a slate roof last",
      volume: { kind: "measured", value: 1900, at: new Date(Date.UTC(2026, 7, 28)) },
      rival: {
        domain: "rival.example",
        url: { kind: "measured", value: "https://rival.example/roofs", at: new Date(Date.UTC(2026, 7, 28)) },
        position: { kind: "measured", value: 3, at: new Date(Date.UTC(2026, 7, 28)) },
      },
    },
  } as unknown,
}));
vi.mock("@/lib/opportunities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/opportunities")>();
  return { ...actual, explainChoice: async () => choice.answer };
});

const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");

const AT = new Date(Date.UTC(2026, 8, 15, 18, 0, 0));
const DEADLINE = new Date(Date.UTC(2026, 8, 16, 18, 0, 0));
const TIME_ZONE = "America/New_York";

function seed(over: { draft?: Row; site?: Row } = {}): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [
    {
      id: "site-1",
      user_id: "user-1",
      timezone: TIME_ZONE,
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00",
      ...over.site,
    },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "site-1",
      state: "in_review",
      veto_deadline: DEADLINE.toISOString(),
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      title: "How long does a slate roof last?",
      body_md: "# How long does a slate roof last?\n\nA slate roof lasts 80 to 150 years.",
      opportunity_id: "opp-1",
      ...over.draft,
    },
  ]);
}

const theDraft = (): Row => db.rows("drafts")[0] as Row;

beforeEach(() => {
  sent = [];
  sendAnswer = { sent: true, id: "vendor-1" };
  seed();
});

describe("the customer is told a page is in review", () => {
  it("one draft-ready mail leaves, carrying the telling, the moment and the stop link", async () => {
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(outcome).toEqual({ sent: true, id: "vendor-1" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.kind).toBe("draft-ready");
    expect(sent[0]!.to).toBe("founder@example.com");
    expect(sent[0]!.subject).toBe("mail.draftReady.subject");

    const paragraph = sent[0]!.blocks.find((b) => b.block === "paragraph");
    expect(paragraph?.text).toBe("mail.draftReady.autopilotWindow");
    // The moment is written in the customer's own zone, not UTC.
    expect(paragraph?.vars?.publishesAt).toContain("EDT");

    const action = sent[0]!.blocks.find((b) => b.block === "action");
    expect(action?.label).toBe("mail.draftReady.stopAction");
    expect(action?.href).toMatch(/\/veto\/[A-Za-z0-9_-]+$/);
  });

  it("the stop link is the token that was actually issued, absolute and openable", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    const href = sent[0]!.blocks.find((b) => b.block === "action")!.href!;
    const token = href.slice(href.lastIndexOf("/") + 1);

    const { hashToken } = await import("@/lib/publish/publishable");
    expect(theDraft().veto_token_hash).toBe(hashToken(decodeURIComponent(token)));
    expect(new URL(href).protocol).toMatch(/^https?:$/);
  });

  it("**recordTold is written only after the seam accepted it**", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    const told = theDraft().told as { kind: string; sentAt: string } | null;
    expect(told).not.toBeNull();
    expect(told!.kind).toBe("interval");
    expect(told!.sentAt).toBe(AT.toISOString());
  });

  it("**a refused send leaves the page untold, and the guard holding**", async () => {
    sendAnswer = { sent: false, reason: "vendor" };
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(outcome).toEqual({ sent: false, reason: "mail" });
    expect(theDraft().told).toBeNull();

    const { toldCurrentPair } = await import("@/lib/publish/publishable");
    const { machineDraftFor } = await import("@/lib/publish/machine");
    const draft = await machineDraftFor("d1");
    expect(toldCurrentPair(draft!).told).toBe(false);
  });

  it.each(["not-composable", "preference-off", "suppressed", "vendor"])(
    "a send refused for %s records nothing — every refusal leaves the telling owed",
    async (reason) => {
      sendAnswer = { sent: false, reason };
      await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
      expect(theDraft().told).toBeNull();
    }
  );
});

describe("once per page, and the natural key is the record itself", () => {
  it("a page already told on the pair now in force is not told again", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(sent).toHaveLength(1);

    const again = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(again).toEqual({ sent: false, reason: "already-told" });
    expect(sent).toHaveLength(1);
  });

  it("but a changed pair is a fresh telling — what they were last told stopped being true", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    // The customer moves their publish hour: REQ-057 c8's pair changed.
    (db.rows("sites")[0] as Row).publish_time = "17:00";

    const again = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(again.sent).toBe(true);
    expect(sent).toHaveLength(2);
  });
});

describe("it refuses to speak about a page this occasion has not arisen for", () => {
  it.each(["generating", "approved", "published", "skipped", "needs_attention"])(
    "a page in %s is not told",
    async (state) => {
      theDraft().state = state;
      const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
      expect(outcome).toEqual({ sent: false, reason: "not-in-review" });
      expect(sent).toEqual([]);
    }
  );

  it("a draft that is not there is reported, never guessed at", async () => {
    const outcome = await sendDraftReadyMail({ draftId: "nope", destination: "wordpress", at: AT });
    expect(outcome).toEqual({ sent: false, reason: "no-draft" });
    expect(sent).toEqual([]);
  });

  it("a site with no stated zone has no moment to name, so nothing is sent and nothing is recorded", async () => {
    (db.rows("sites")[0] as Row).timezone = null;
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(outcome).toEqual({ sent: false, reason: "not-yet-tellable" });
    expect(sent).toEqual([]);
    expect(theDraft().told).toBeNull();
  });

  it("no account to write to is reported rather than mailed into the void", async () => {
    db.seed("users", []);
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(outcome).toEqual({ sent: false, reason: "no-account" });
    expect(sent).toEqual([]);
  });
});

describe("REQ-057 c7 — the zero-window mail is the whole of the telling", () => {
  beforeEach(() => {
    seed({ site: { veto_hours: 0 } });
  });

  it("it says there is no interval, offers no stop link, and is sent anyway", async () => {
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(outcome.sent).toBe(true);
    expect(sent[0]!.blocks.find((b) => b.block === "paragraph")?.text).toBe(
      "mail.draftReady.autopilotZero"
    );
    // No link, because no link would stop it — an offer the product could
    // not keep.
    expect(sent[0]!.blocks.find((b) => b.block === "action")).toBeUndefined();
    // The one occasion the customer's own switch is not asked.
    expect(sent[0]!.suppressible).toBe(false);
  });
});

describe("copilot — nothing happens until they approve", () => {
  beforeEach(() => {
    seed({ site: { mode: "copilot" } });
  });

  it("it names no moment and offers no stop link, and the switch is asked as usual", async () => {
    const outcome = await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(outcome.sent).toBe(true);
    const paragraph = sent[0]!.blocks.find((b) => b.block === "paragraph");
    expect(paragraph?.text).toBe("mail.draftReady.copilot");
    expect(paragraph?.vars).toBeUndefined();
    expect(sent[0]!.blocks.find((b) => b.block === "action")).toBeUndefined();
    expect(sent[0]!.suppressible).toBeUndefined();
  });
});

describe("issue #183 — the mail names the page, and says why §7 chose it", () => {
  const blocksOf = () => sent[0]!.blocks;

  it("**the title travels in the body block that carries the GeneratedText label**", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    const body = blocksOf().find((b) => b.block === "pageBody") as unknown as {
      pageTitle: string;
      written: boolean;
      markdown: string;
    };
    expect(body.pageTitle).toBe("How long does a slate roof last?");
    // `written`, not proposed: this page is written and in review.
    expect(body.written).toBe(true);
    expect(body.markdown).toContain("A slate roof lasts");
  });

  it("**and never in the subject**, which stays registry copy", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(sent[0]!.subject).toBe("mail.draftReady.subject");
    expect(sent[0]!.subject).not.toContain("slate roof");
    // The shape is what holds it: a subject is a copy key, so a title
    // could not be put there without changing the mail's own type.
    expect(sent[0]!.subject.startsWith("mail.")).toBe(true);
  });

  it("the page block leads — the mail is about a page, and says which first", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    expect(blocksOf()[0]!.block).toBe("pageBody");
  });

  it("the why-data is §7's stored evidence: the search, and how often it is searched", async () => {
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    const search = blocksOf().find((b) => b.text === "mail.draftReady.why.search");
    expect(search?.vars?.query).toBe("how long does a slate roof last");

    const volume = blocksOf().find((b) => b.block === "stat") as unknown as {
      label: string;
      value: { kind: string; value: number };
      format: string;
    };
    expect(volume.label).toBe("mail.draftReady.why.volume");
    expect(volume.value).toMatchObject({ kind: "measured", value: 1900 });
    expect(volume.format).toBe("perMonth");
  });

  it("**it is read, never re-measured** — the mail states the number the page was chosen on", async () => {
    // The stored evidence says 1,900. Nothing in the mail path may go and
    // ask again: a fresher number would be a page chosen on one figure and
    // announced on another, and the screen and the mail would disagree.
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
    const volume = blocksOf().find((b) => b.block === "stat") as unknown as {
      value: { value: number; at: Date };
    };
    expect(volume.value.value).toBe(1900);
    expect(volume.value.at).toEqual(new Date(Date.UTC(2026, 7, 28)));
  });

  it("an improve page states its own stored search and volume the same way", async () => {
    choice.answer = {
      opportunityId: "opp-2",
      type: "improve",
      family: "improve",
      fitBand: "reach",
      acceptance: { form: "top20", query: "re-pointing a chimney cost" },
      evidence: {
        family: "improve",
        query: "re-pointing a chimney cost",
        volume: { kind: "measured", value: 720, at: new Date(Date.UTC(2026, 7, 28)) },
        pageUrl: "https://example.com/chimneys",
        shortfall: { kind: "thin", visibleChars: 400 },
      },
    };
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(blocksOf().find((b) => b.text === "mail.draftReady.why.search")?.vars?.query).toBe(
      "re-pointing a chimney cost"
    );
  });

  it("a fix page carries no why-data — it has no search and no volume, and Fix never automates", async () => {
    choice.answer = {
      opportunityId: "opp-3",
      type: "unblock",
      family: "fix",
      fitBand: null,
      acceptance: { form: "gate_cleared", gate: "robots_blocked" },
      evidence: { family: "fix", barrier: "robots_blocked", foundOnUrl: "https://example.com/" },
    };
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(blocksOf().find((b) => b.text === "mail.draftReady.why.search")).toBeUndefined();
    expect(blocksOf().find((b) => b.block === "stat")).toBeUndefined();
    // The page is still named, and the telling still said what it says.
    expect(blocksOf().find((b) => b.block === "pageBody")).toBeDefined();
    expect(blocksOf().find((b) => b.text === "mail.draftReady.autopilotWindow")).toBeDefined();
  });

  it("a page whose opportunity has been purged is still named, and states no why-data", async () => {
    choice.answer = null;
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    expect(blocksOf().find((b) => b.block === "pageBody")).toBeDefined();
    expect(blocksOf().find((b) => b.text === "mail.draftReady.why.search")).toBeUndefined();
  });

  it("every sentence it speaks is a registry key, and the title is not one of them", async () => {
    const { COPY } = await import("@/lib/presentation/copy");
    await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });

    for (const key of ["mail.draftReady.why.search", "mail.draftReady.why.volume"]) {
      expect(Object.keys(COPY)).toContain(key);
      expect(COPY[key as keyof typeof COPY]).toBe("");
    }
    // The title has no key of its own: it is carried by the label, which
    // does (`generated.page.written`).
    expect(Object.keys(COPY)).not.toContain("mail.draftReady.title");
    expect(Object.keys(COPY)).toContain("generated.page.written");
  });
});
