// SPEC §5 — a WordPress set up without its login: no page can go live, so the draft-ready mail names no moment, says it
// waits, and links signed onto Settings › Pages. Through the occasion from stored rows; the seam is stubbed, 0¢.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import type { MailBlock } from "@/lib/mail/blocks/types";

applyEnvFixture();
const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
type Sent = { subject: string; preheader: string; blocks: readonly MailBlock[] };
let sent: Sent[] = [];
vi.mock("@/lib/mail/send", () => ({ sendEmail: async (m: Sent) => (sent.push(m), { sent: true, id: "vendor-1" }) }));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  explainChoice: async () => null,
}));

const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");

const AT = new Date(Date.UTC(2026, 8, 15, 18, 0, 0));
const NEVER_CONNECTED = { health: "expired", health_reason: "never_connected", config: null };

async function received(destination: Row): Promise<Sent> {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "harborplumbing.example", timezone: "America/Chicago", mode: "autopilot", veto_hours: 24, publish_time: "09:00" }]);
  db.seed("drafts", [{ id: "d1", site_id: "site-1", state: "in_review", veto_deadline: "2026-09-16T18:00:00.000Z", approved_at: null, approved_by: null, told: null, transitions: [], hard_rules_passed: true, publishable_since: null, title: "Burst pipe: the first hour", body_md: "Shut off the main valve.", opportunity_id: null }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "site-1", kind: "wordpress", hostname: null, deleted_at: null, ...destination }]);
  sent = [];
  await sendDraftReadyMail({ draftId: "d1", destination: "wordpress", at: AT });
  return sent[0]!;
}
const texts = (m: Sent) => m.blocks.map((b) => ("text" in b ? b.text : undefined));
const connectHref = (m: Sent) => m.blocks.flatMap((b) => (b.block === "action" && b.label === "mail.weekly.connect.action" ? [b.href] : []))[0];

beforeEach(() => registerSignInLinkIssuer(async () => ({ issued: true, url: "https://reachkit.example/auth/confirm?token_hash=t", expiresAt: AT })));
afterEach(() => registerSignInLinkIssuer(null));

describe("a WordPress never connected: the draft-ready mail names no moment", () => {
  it("says it waits, names the site's domain, keeps Stop, and links signed onto Settings › Pages", async () => {
    const mail = await received(NEVER_CONNECTED);
    expect([mail.subject, mail.preheader]).toEqual(["mail.draftReady.waiting.subject", "mail.draftReady.waiting.preheader"]);
    expect(texts(mail)).not.toContain("mail.draftReady.autopilotWindow");
    expect(texts(mail)).not.toContain("mail.draftReady.autopilotZero");
    expect(mail.blocks).toContainEqual({ block: "notice", text: "mail.draftReady.dest.wordpressNotConnected", vars: { site: "harborplumbing.example" } });
    expect(mail.blocks.some((b) => b.block === "action" && b.label === "mail.draftReady.stopAction")).toBe(true);
    const href = new URL(connectHref(mail)!);
    expect([href.origin + href.pathname, href.searchParams.get("next")]).toEqual(["https://reachkit.example/auth/confirm", "/app/settings/pages"]);
  });

  it("with no link issued, the same page unsigned", async () => {
    registerSignInLinkIssuer(async () => ({ issued: false, reason: "vendor" }));
    expect(connectHref(await received(NEVER_CONNECTED))).toBe("https://reachkit.example/app/settings/pages");
  });

  it("a working WordPress still names its moment, with the usual subject and no connect link", async () => {
    const mail = await received({ health: "ok", health_reason: null, config: null });
    expect(mail.subject).toBe("mail.draftReady.subject");
    expect(texts(mail)).toContain("mail.draftReady.autopilotWindow");
    expect(connectHref(mail)).toBeUndefined();
  });
});
