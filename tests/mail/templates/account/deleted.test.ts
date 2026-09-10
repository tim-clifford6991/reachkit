// tests/mail/templates/account/deleted.test.ts — REQ-079 c6
//
// The one `account` mail a deleted account leaves behind. Criterion 6 gives
// each of §9's four WordPress outcomes "one sentence of its own, carrying
// that outcome's own count and, where there is anywhere to look, its own
// place — and no sentence carries two outcomes or one count for both".
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildAccountDeleted } = await import("../../../../src/lib/mail/templates/account");
const { COPY, copy } = await import("../../../../src/lib/presentation/copy");
const { OWNER_OWED } = await import("../../../../src/lib/presentation/copy/registry");
const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
const { escapeHtml } = await import("../../../../src/lib/mail/blocks/html");

/** The ten sentences this mail can speak. Every one was owner-owed and
 *  empty — the send seam refused to compose rather than ship a blank line —
 *  until issue #458 filled them on the owner's 2026-09-10 approval. The
 *  mail now composes from them. */
const DELETED_MAIL_KEYS = [
  "mail.account.deleted.subject",
  "mail.account.deleted.still_live",
  "mail.account.deleted.theirs_to_keep",
  "mail.account.deleted.wordpress.returned_to_draft",
  "mail.account.deleted.wordpress.returned_to_draft.no_place",
  "mail.account.deleted.wordpress.named_for_removal",
  "mail.account.deleted.wordpress.named_for_removal.no_place",
  "mail.account.deleted.wordpress.already_gone",
  "mail.account.deleted.wordpress.unreachable",
  "mail.account.deleted.wordpress.unreachable.no_place",
] as const;

const PLACE = { siteBaseUrl: "https://theirs.example/", stampSlug: "tag/reachkit" };

describe("REQ-079 c6 — one sentence per outcome, in a fixed order", () => {
  it("four outcomes give four paragraphs, in §9's order, each with its own count", () => {
    const mail = buildAccountDeleted({
      leftInWordPress: {
        unreachable: { count: 7, place: null },
        already_gone: { count: 5, place: null },
        named_for_removal: { count: 3, place: null },
        returned_to_draft: { count: 2, place: null },
      },
    });
    expect(mail.blocks.slice(0, 4)).toEqual([
      {
        block: "paragraph",
        text: "mail.account.deleted.wordpress.returned_to_draft.no_place",
        vars: { count: "2" },
      },
      {
        block: "paragraph",
        text: "mail.account.deleted.wordpress.named_for_removal.no_place",
        vars: { count: "3" },
      },
      {
        block: "paragraph",
        text: "mail.account.deleted.wordpress.already_gone",
        vars: { count: "5" },
      },
      {
        block: "paragraph",
        text: "mail.account.deleted.wordpress.unreachable.no_place",
        vars: { count: "7" },
      },
    ]);
  });

  it("an outcome absent from the map is not named at all — the mail cannot render a zero", () => {
    const mail = buildAccountDeleted({ leftInWordPress: { already_gone: { count: 1, place: null } } });
    const texts = mail.blocks.map((block) => ("text" in block ? block.text : ""));
    expect(texts.filter((text) => text.includes("wordpress."))).toEqual([
      "mail.account.deleted.wordpress.already_gone",
    ]);
    for (const block of mail.blocks) {
      if ("vars" in block && block.vars !== undefined) expect(block.vars["count"]).not.toBe("0");
    }
  });

  it("already_gone has one form only, so a place has nowhere to be written even if one is supplied", () => {
    const mail = buildAccountDeleted({
      leftInWordPress: { already_gone: { count: 1, place: PLACE } },
    });
    expect(mail.blocks[0]).toEqual({
      block: "paragraph",
      text: "mail.account.deleted.wordpress.already_gone",
      vars: { count: "1" },
    });
  });

  it("where a place exists, the sentence naming it is used and carries the address", () => {
    const mail = buildAccountDeleted({
      leftInWordPress: { returned_to_draft: { count: 4, place: PLACE } },
    });
    expect(mail.blocks[0]).toEqual({
      block: "paragraph",
      text: "mail.account.deleted.wordpress.returned_to_draft",
      vars: { count: "4", place: "https://theirs.example/tag/reachkit" },
    });
  });

  it("a base address that will not parse falls back to the form naming no place, count intact", () => {
    const mail = buildAccountDeleted({
      leftInWordPress: {
        returned_to_draft: { count: 4, place: { siteBaseUrl: "not a url", stampSlug: "x" } },
      },
    });
    expect(mail.blocks[0]).toEqual({
      block: "paragraph",
      text: "mail.account.deleted.wordpress.returned_to_draft.no_place",
      vars: { count: "4" },
    });
  });
});

describe("REQ-079 c6 — the still-live half, and what every version of this mail carries", () => {
  it("the still-live sentence carries its own count and stands first", () => {
    const mail = buildAccountDeleted({ stillLive: 3, leftInWordPress: {} });
    expect(mail.blocks[0]).toEqual({
      block: "paragraph",
      text: "mail.account.deleted.still_live",
      vars: { count: "3" },
    });
  });

  it("it says of every post still in that site that it is theirs to keep or remove", () => {
    const mail = buildAccountDeleted({
      leftInWordPress: { returned_to_draft: { count: 1, place: null } },
    });
    const texts = mail.blocks.map((block) => ("text" in block ? block.text : ""));
    expect(texts).toContain("mail.account.deleted.theirs_to_keep");
  });

  it("a mail with nothing left in WordPress carries no theirs-to-keep line", () => {
    const mail = buildAccountDeleted({ stillLive: 1, leftInWordPress: {} });
    const texts = mail.blocks.map((block) => ("text" in block ? block.text : ""));
    expect(texts).not.toContain("mail.account.deleted.theirs_to_keep");
  });

  it("it lists no post, whatever the number: every block is a paragraph or the notice", () => {
    const mail = buildAccountDeleted({
      stillLive: 40,
      leftInWordPress: { unreachable: { count: 900, place: PLACE } },
    });
    expect(mail.blocks.every((block) => block.block === "paragraph" || block.block === "notice")).toBe(
      true
    );
    expect(mail.blocks.some((block) => block.block === "list")).toBe(false);
  });

  it("it names a way to reach a person, as every account mail does", () => {
    const mail = buildAccountDeleted({ stillLive: 1, leftInWordPress: {} });
    expect(mail.blocks.at(-1)).toEqual({ block: "notice", text: "mail.account.reach_a_person" });
  });
});

describe("REQ-093 — every sentence is a registry key, and all ten are the owner's", () => {
  it("all ten are declared in the registry", () => {
    for (const key of DELETED_MAIL_KEYS) expect(Object.keys(COPY)).toContain(key);
  });

  it("all ten are written (issue #458, the owner's 2026-09-10 approval), so the mail composes and speaks each one, slots filled", () => {
    expect(DELETED_MAIL_KEYS).toHaveLength(10);
    for (const key of DELETED_MAIL_KEYS) {
      expect(COPY[key], key).not.toBe("");
      expect(OWNER_OWED, key).not.toContain(key);
    }

    // Two mails between them reach every one of the ten: one where each
    // outcome has a place to name, one where none has.
    const withPlace = buildAccountDeleted({
      stillLive: 2,
      leftInWordPress: {
        returned_to_draft: { count: 4, place: PLACE },
        named_for_removal: { count: 3, place: PLACE },
        already_gone: { count: 5, place: null },
        unreachable: { count: 7, place: PLACE },
      },
    });
    const withoutPlace = buildAccountDeleted({
      leftInWordPress: {
        returned_to_draft: { count: 4, place: null },
        named_for_removal: { count: 3, place: null },
        unreachable: { count: 7, place: null },
      },
    });

    const spoken = new Set<string>();
    for (const mail of [withPlace, withoutPlace]) {
      const composed = composeMail({ kind: "account", subject: mail.subject, blocks: mail.blocks });
      expect(composed.subject).toBe(COPY["mail.account.deleted.subject"]);
      spoken.add(mail.subject);
      for (const block of mail.blocks) {
        if (block.block !== "paragraph") continue;
        const sentence = copy(block.text, block.vars);
        // Every slot the sentence declares is filled: no marker survives.
        expect(sentence, block.text).not.toMatch(/\{\w+\}/);
        expect(composed.text, block.text).toContain(sentence);
        expect(composed.html, block.text).toContain(escapeHtml(sentence));
        spoken.add(block.text);
      }
    }
    expect([...spoken].sort()).toEqual([...DELETED_MAIL_KEYS].sort());
    // The place reached the rendered mail, not only the marker's absence.
    const placed = composeMail({ kind: "account", subject: withPlace.subject, blocks: withPlace.blocks });
    expect(placed.text).toContain("https://theirs.example/tag/reachkit");
  });
});
