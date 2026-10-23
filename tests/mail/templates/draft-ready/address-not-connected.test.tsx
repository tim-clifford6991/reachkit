// The draft-ready mail for a hosted address that is not connected carries the
// one setting the Overview shows, so board OverviewDNS's "The same setting is
// in your first page's mail" is true (owner R20, 2026-10-22).
//
// Driven through the occasion module from stored rows, then composed into the
// two bodies a customer receives.
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();
const EDGE = "hosted.example.net";
process.env.HOSTED_EDGE_CNAME_TARGET = EDGE;

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "../../../publish/harness";
import type { MailBlock } from "@/lib/mail/blocks/types";
import type { CopyKey } from "@/lib/presentation/copy";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

interface SentMail {
  subject: string;
  subjectVars?: Record<string, string | number>;
  reason?: string;
  blocks: readonly MailBlock[];
}
let sent: SentMail[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: SentMail) => {
    sent.push(m);
    return { sent: true, id: "vendor-1" };
  },
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  explainChoice: async () => null,
}));

const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");
const { composeMail } = await import("@/lib/mail/shell/compose");
const { escapeHtml } = await import("@/lib/mail/blocks/html");
const { recordForHost } = await import("@/lib/publish/setup/cards");
const { copy } = await import("@/lib/presentation/copy");
const { ConnectAddress } = await import("@/app/(account)/app/_overview/ConnectAddress");

const AT = new Date(Date.UTC(2026, 8, 15, 18, 0, 0));
const PLUMBER = "help.harborplumbing.example";
const SAAS = "guides.acmecrm.example";
const LABELS = ["mail.draftReady.record.type", "mail.draftReady.record.name", "mail.draftReady.record.value"] as const;

function seed(destination: { kind: "hosted" | "wordpress"; hostname?: string; state?: "pending_dns" | "live" }): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [
    { id: "site-1", user_id: "user-1", timezone: "America/Chicago", mode: "autopilot", veto_hours: 24, publish_time: "09:00" },
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
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: destination.kind,
      hostname: destination.hostname ?? null,
      hostname_state: destination.state ?? null,
      health: "ok",
      deleted_at: null,
    },
  ]);
}

/** The mail the occasion sent, as the customer receives it. */
async function received(destination: "hosted" | "wordpress"): Promise<{ blocks: readonly MailBlock[]; html: string; text: string }> {
  sent = [];
  await sendDraftReadyMail({ draftId: "d1", destination, at: AT });
  const m = sent[0]!;
  const composed = await composeMail({
    kind: "draft-ready",
    subject: m.subject as CopyKey,
    subjectVars: m.subjectVars,
    blocks: m.blocks,
    reason: m.reason as CopyKey | undefined,
  });
  return { blocks: m.blocks, html: composed.html, text: composed.text };
}

/** The Overview's record fields for a host, as `/app`'s unconnected arm draws them. */
function overviewFields(hostname: string): string[] {
  const record = recordForHost({ hostname, cnameTarget: EDGE })!;
  const html = renderToStaticMarkup(
    <ConnectAddress connect={{ hostname, record, checkedAt: null, since: null }} page={null} timeZone="America/Chicago" today={AT} />
  );
  return ["dns-type", "dns-name", "dns-value"].map(
    (id) => new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`, "u").exec(html)?.[1] ?? ""
  );
}

const recordBlocks = (blocks: readonly MailBlock[]): MailBlock[] =>
  blocks.filter((b) => b.block === "facts" && b.items.some((row) => row.label === "mail.draftReady.record.type"));

beforeAll(async () => {
  await composeMail({ kind: "draft-ready", subject: "mail.draftReady.subject", blocks: [] }).catch(() => null);
}, 60_000);

beforeEach(() => {
  sent = [];
});

describe("a hosted address not connected: the draft-ready mail carries the setting", () => {
  it.each([PLUMBER, SAAS])("%s: carries the record the Overview shows", async (hostname) => {
    seed({ kind: "hosted", hostname, state: "pending_dns" });
    const record = recordForHost({ hostname, cnameTarget: EDGE })!;
    const { html, text } = await received("hosted");
    const [type, name, value] = overviewFields(hostname);

    expect([type, value]).toEqual([record.type, record.value]);
    for (const [key, field] of [[LABELS[0], type], [LABELS[1], name], [LABELS[2], value]] as const) {
      expect(text).toContain(`${copy(key)}: ${field}`);
      expect(html).toContain(escapeHtml(field!));
    }
    // The line says the setting is below, after it is introduced.
    expect(text.indexOf(copy("mail.draftReady.dest.addressNotConnected", { site: hostname }))).toBeLessThan(
      text.indexOf(`${copy(LABELS[0])}: ${type}`)
    );
    // Plain text a desk can copy: never a link.
    expect(html).not.toContain(`href="http://${value}`);
    expect(html).not.toContain(`href="https://${value}`);
  });

  it("mail and Overview agree", async () => {
    seed({ kind: "hosted", hostname: PLUMBER, state: "pending_dns" });
    const { blocks } = await received("hosted");
    const [record] = recordBlocks(blocks);
    expect(record?.block === "facts" ? record.items.map((row) => row.value) : []).toEqual(overviewFields(PLUMBER));
  });

  it("no record when the host has none", async () => {
    seed({ kind: "hosted", hostname: "harborplumbing", state: "pending_dns" });
    expect(recordForHost({ hostname: "harborplumbing", cnameTarget: EDGE })).toBeNull();
    const { blocks, text } = await received("hosted");
    expect(recordBlocks(blocks)).toEqual([]);
    expect(text).not.toContain(EDGE);
    expect(text).toContain(copy("mail.draftReady.dest.addressNotConnected.noRecord", { site: "harborplumbing" }));
    expect(text).not.toContain(copy("mail.draftReady.dest.addressNotConnected", { site: "harborplumbing" }));
  });

  it("only the not-connected arm carries a record", async () => {
    seed({ kind: "hosted", hostname: PLUMBER, state: "live" });
    expect(recordBlocks((await received("hosted")).blocks)).toEqual([]);
    seed({ kind: "wordpress" });
    expect(recordBlocks((await received("wordpress")).blocks)).toEqual([]);
  });
});
