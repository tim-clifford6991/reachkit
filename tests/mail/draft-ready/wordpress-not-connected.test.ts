// SPEC §5 — the draft-ready mail for a WordPress set up without its login: no page can go live, so no moment is named,
// the subject says it waits, and the one way forward is a signed link onto Settings › Pages. Driven through the occasion
// module from stored rows; the seam is stubbed, so nothing is sent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import type { MailBlock } from "@/lib/mail/blocks/types";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

let sent: { subject: string; preheader: string; blocks: readonly MailBlock[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: (typeof sent)[number]) => {
    sent.push(m);
    return { sent: true, id: "vendor-1" };
  },
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  explainChoice: async () => null,
}));

const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");

const AT = new Date(Date.UTC(2026, 8, 15, 18, 0, 0));
const SIGNED = "https://reachkit.example/auth/confirm?token_hash=t";
const MOMENT = ["mail.draftReady.autopilotWindow", "mail.draftReady.autopilotZero"];

function seed(destination: Row): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [
    { id: "site-1", user_id: "user-1", domain: "harborplumbing.example", timezone: "America/Chicago", mode: "autopilot", veto_hours: 24, publish_time: "09:00" },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "site-1",
      state: "in_review",
      veto_deadline: new Date(Date.UTC(2026, 8, 16, 18)).toISOString(),
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      title: "What to do in the first hour of a burst pipe",
      body_md: "Shut off the main valve first.",
      opportunity_id: null,
    },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: "site-1", kind: "wordpress", hostname: null, deleted_at: null, ...destination }]);
}

async function received(): Promise<(typeof sent)[number]> {
  sent = [];
  await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
  return sent[0]!;
}

const texts = (blocks: readonly MailBlock[]) => blocks.map((b) => ("text" in b ? b.text : undefined));
const connectAction = (blocks: readonly MailBlock[]) =>
  blocks.find((b) => b.block === "action" && b.label === "mail.weekly.connect.action") as { href: string } | undefined;

beforeEach(() => {
  registerSignInLinkIssuer(async () => ({ issued: true, url: SIGNED, expiresAt: AT }));
});
afterEach(() => {
  registerSignInLinkIssuer(null);
});

describe("a WordPress never connected: the draft-ready mail names no moment", () => {
  it("says it waits, names the site's domain, keeps Stop, and links signed onto Settings › Pages", async () => {
    seed({ health: "expired", health_reason: "never_connected", config: null });
    const mail = await received();
    expect(mail.subject).toBe("mail.draftReady.waiting.subject");
    expect(mail.preheader).toBe("mail.draftReady.waiting.preheader");
    for (const key of MOMENT) expect(texts(mail.blocks)).not.toContain(key);
    expect(mail.blocks).toContainEqual({ block: "notice", text: "mail.draftReady.dest.wordpressNotConnected", vars: { site: "harborplumbing.example" } });
    expect(mail.blocks.some((b) => b.block === "action" && b.label === "mail.draftReady.stopAction")).toBe(true);
    const href = new URL(connectAction(mail.blocks)!.href);
    expect(href.origin + href.pathname).toBe("https://reachkit.example/auth/confirm");
    expect(href.searchParams.get("next")).toBe("/app/settings/pages");
  });

  it("with no link issued, the same page unsigned", async () => {
    registerSignInLinkIssuer(async () => ({ issued: false, reason: "vendor" }));
    seed({ health: "expired", health_reason: "never_connected", config: null });
    expect(connectAction((await received()).blocks)?.href).toBe("https://reachkit.example/app/settings/pages");
  });

  it("a working WordPress still names its moment, with the usual subject and no connect link", async () => {
    seed({ health: "ok", health_reason: null, config: null });
    const mail = await received();
    expect(mail.subject).toBe("mail.draftReady.subject");
    expect(texts(mail.blocks)).toContain("mail.draftReady.autopilotWindow");
    expect(connectAction(mail.blocks)).toBeUndefined();
  });
});
