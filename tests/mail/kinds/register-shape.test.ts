// BUILD §12 — the register holds exactly the kinds BUILD names, and nothing else.
import { describe, expect, it } from "vitest";
import { MAIL_KINDS, TOGGLE_KINDS, type KindRow, type MailKind } from "../../../src/lib/mail/kinds";

/** The register's rows as the declared shape, so an optional member can be
 *  asked about across every row rather than only where it is present. */
const ROWS = MAIL_KINDS as Readonly<Record<MailKind, KindRow>>;

const DECLARED = [
  "magic-link",
  "report",
  "first-page",
  "first-page-unavailable",
  "nurture",
  "draft-ready",
  "published",
  "weekly",
  "setup-reminder",
  "account",
  // The owner's own alert (issue #329) — the eleventh, and the only kind
  // whose reader is not a customer.
  "ops",
] as const;

describe("BUILD §12 — the register of mail kinds", () => {
  it("holds exactly the eleven declared kinds", () => {
    expect(Object.keys(MAIL_KINDS).sort()).toEqual([...DECLARED].sort());
    expect(Object.keys(MAIL_KINDS)).toHaveLength(11);
  });

  it("every stoppability is one of the three admitted values", () => {
    for (const [kind, row] of Object.entries(MAIL_KINDS)) {
      expect([false, "toggle", "opt-out"], kind).toContain(row.stoppable);
    }
  });

  it("the three recurring mails are the toggle rows, and nothing else is", () => {
    expect([...TOGGLE_KINDS].sort()).toEqual(["draft-ready", "published", "weekly"]);
  });

  it("the lead sequence is the one address-wide opt-out kind", () => {
    const optOut = (Object.keys(MAIL_KINDS) as MailKind[]).filter(
      (kind) => MAIL_KINDS[kind].stoppable === "opt-out"
    );
    expect(optOut).toEqual(["nurture"]);
  });

  it("the sign-in, account and setup mails can be stopped by nothing", () => {
    for (const kind of ["magic-link", "account", "setup-reminder"] as const) {
      expect(MAIL_KINDS[kind].stoppable, kind).toBe(false);
    }
  });

  it("the giveaway page and its unavailable twin are unstoppable — they are what the reader asked for", () => {
    for (const kind of ["first-page", "first-page-unavailable", "report"] as const) {
      expect(MAIL_KINDS[kind].stoppable, kind).toBe(false);
    }
  });

  it("unsuppressibleWhen is named on draft-ready and nowhere else", () => {
    const named = (Object.keys(ROWS) as MailKind[]).filter(
      (kind) => ROWS[kind].unsuppressibleWhen !== undefined
    );
    expect(named).toEqual(["draft-ready"]);
  });

  it("every kind is a legal directory name — MailKind and the directory are the same string (ADR-040)", () => {
    for (const kind of Object.keys(MAIL_KINDS)) {
      expect(kind, kind).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("the register is frozen: a tenth kind cannot be added at runtime", () => {
    expect(() => {
      (MAIL_KINDS as unknown as Record<string, unknown>).newsletter = { occasionsFrom: "§0", stoppable: false };
    }).toThrow(TypeError);
    expect(Object.keys(MAIL_KINDS)).toHaveLength(11);
  });

  it("a mail on an unregistered occasion does not typecheck", () => {
    // @ts-expect-error — "newsletter" is not a MailKind, and there is no
    // row to make it one. BUILD §12: the product sends no marketing,
    // newsletter or promotional mail at all.
    const bad: MailKind = "newsletter";
    expect(bad).toBeTruthy();
  });
});
