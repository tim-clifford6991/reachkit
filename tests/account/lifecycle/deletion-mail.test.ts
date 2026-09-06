// tests/account/lifecycle/deletion-mail.test.ts — REQ-079 c6
//
// "Because criterion 7 leaves the customer no ReachKit surface to read
// afterwards, the naming criterion 4 puts on such a surface is carried
// instead by one `account` mail sent to the address being deleted. … Where
// nothing of either kind is left behind, no such mail is sent."
//
// **"Either kind" is the whole send condition**, so the case that decides
// this file is the one where `stillLive` is empty and `leftInWordPress`
// holds an entry: a run that reached every destination but left posts in a
// customer's own site still sends.
//
// The other discriminating case is ADR-051's first consequence: the mail
// composes **after** the tombstone is stamped, which only holds because the
// row is present and hidden rather than gone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishResult } from "@/lib/publish/types";

applyEnvFixture();

interface SentMail {
  kind: string;
  to: string;
  subject: string;
  blocks: { block: string; text?: string; vars?: Record<string, string | number> }[];
  tombstoneAt: string | null | undefined;
}

const sent: SentMail[] = [];
const outcomes = new Map<string, UnpublishResult>();
let readTombstone: () => string | null | undefined = () => undefined;

vi.mock("@/lib/publish/attempt/unpublish", () => ({
  unpublish: async (a: { draftId: string }): Promise<UnpublishResult> =>
    outcomes.get(a.draftId) ?? { ok: true, outcome: "removed" },
}));

vi.mock("@/lib/publish/switch", () => ({
  setPublishing: async () => ({ recordedAt: new Date() }),
}));

vi.mock("@/lib/account/billing", () => ({
  endSubscriptionNow: async (_userId: string, now: Date) => ({ ok: true, endedAt: now }),
}));

vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: Omit<SentMail, "tombstoneAt">) => {
    sent.push({ ...m, tombstoneAt: readTombstone() });
    return { sent: true, id: "mail-1" };
  },
}));

const { deleteAccount } = await import("@/lib/account/lifecycle/delete-account");
const { setLifecycleStore, setStampCapability } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle, account } = await import("./memory-store");

const NOW = new Date("2026-09-06T12:00:00.000Z");
let state = newMemoryLifecycle();

beforeEach(() => {
  sent.length = 0;
  outcomes.clear();
  state = newMemoryLifecycle();
  state.sites.push({ id: "site-1", user_id: "u-1" });
  state.accounts.push(account({ id: "u-1", email: "leaving@example.com" }));
  readTombstone = () => state.accounts[0]?.deleted_at;
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
  setStampCapability(null);
});

function live(draftId: string, destination: string, url: string | null): void {
  state.publications.push({ draft_id: draftId, destination, live_url: url });
}

describe("REQ-079 c6 — one mail, and only where something of either kind is left", () => {
  it("one account mail when stillLive is non-empty, to the address being deleted", async () => {
    live("a", "wordpress", "https://theirs.example/one");
    outcomes.set("a", { ok: false, reason: "credentials_expired" });
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok && run.result.mailSent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.kind).toBe("account");
    expect(sent[0]?.to).toBe("leaving@example.com");
    expect(sent[0]?.blocks.some((b) => b.text === "mail.account.deleted.still_live")).toBe(true);
  });

  it("one mail when stillLive is empty but leftInWordPress holds an entry — the 'either kind' case", async () => {
    live("a", "wordpress", null);
    outcomes.set("a", { ok: true, outcome: "returned_to_draft" });
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok && run.result.stillLive).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(
      sent[0]?.blocks.some(
        (b) => b.text === "mail.account.deleted.wordpress.returned_to_draft.no_place"
      )
    ).toBe(true);
  });

  it("no mail when both are empty", async () => {
    live("a", "hosted", null);
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok && run.result.mailSent).toBe(false);
    expect(sent).toEqual([]);
  });

  it("no mail when there was nothing published at all", async () => {
    await deleteAccount({ siteId: "site-1", now: NOW });
    expect(sent).toEqual([]);
  });
});

describe("REQ-079 c6 — one sentence per outcome, each with its own count, and no post listed", () => {
  it("four outcomes give four paragraphs, each carrying its own count", async () => {
    const arms = [
      ["a", "returned_to_draft", 2],
      ["b", "named_for_removal", 3],
      ["c", "already_gone", 5],
      ["d", "unreachable", 7],
    ] as const;
    for (const [prefix, outcome, count] of arms) {
      for (let i = 0; i < count; i += 1) {
        const id = `${prefix}${i}`;
        live(id, "wordpress", null);
        outcomes.set(
          id,
          outcome === "unreachable"
            ? { ok: true, outcome, retryOffered: true }
            : { ok: true, outcome }
        );
      }
    }
    await deleteAccount({ siteId: "site-1", now: NOW });
    const counts = new Map(
      (sent[0]?.blocks ?? [])
        .filter((b) => (b.text ?? "").includes("wordpress."))
        .map((b) => [b.text, b.vars?.["count"]])
    );
    expect(counts.get("mail.account.deleted.wordpress.returned_to_draft.no_place")).toBe("2");
    expect(counts.get("mail.account.deleted.wordpress.named_for_removal.no_place")).toBe("3");
    expect(counts.get("mail.account.deleted.wordpress.already_gone")).toBe("5");
    expect(counts.get("mail.account.deleted.wordpress.unreachable.no_place")).toBe("7");
    expect(counts.size).toBe(4);
  });

  it("the mail lists no post, whatever the number, and says they are theirs to keep or remove", async () => {
    for (const id of ["a", "b", "c"]) {
      live(id, "wordpress", null);
      outcomes.set(id, { ok: true, outcome: "returned_to_draft" });
    }
    await deleteAccount({ siteId: "site-1", now: NOW });
    const blocks = sent[0]?.blocks ?? [];
    expect(blocks.every((b) => b.block === "paragraph" || b.block === "notice")).toBe(true);
    expect(blocks.some((b) => b.text === "mail.account.deleted.theirs_to_keep")).toBe(true);
  });

  it("where the site took the stamp, the sentence naming a place is used instead", async () => {
    setStampCapability({
      async place() {
        return { siteBaseUrl: "https://theirs.example/", stampSlug: "tag/reachkit" };
      },
    });
    state.destinations.push({ id: "dest-1", kind: "wordpress" });
    live("a", "wordpress", null);
    outcomes.set("a", { ok: true, outcome: "returned_to_draft" });
    await deleteAccount({ siteId: "site-1", now: NOW });
    const block = (sent[0]?.blocks ?? []).find(
      (b) => b.text === "mail.account.deleted.wordpress.returned_to_draft"
    );
    expect(block?.vars).toEqual({
      count: "1",
      place: "https://theirs.example/tag/reachkit",
    });
  });
});

describe("ADR-051 — the mail composes after the tombstone, because the row is hidden rather than gone", () => {
  it("the tombstone is already stamped when the mail is composed", async () => {
    live("a", "wordpress", "https://theirs.example/one");
    outcomes.set("a", { ok: false, reason: "network" });
    await deleteAccount({ siteId: "site-1", now: NOW });
    expect(sent[0]?.tombstoneAt).toBe(NOW.toISOString());
  });
});
