// BUILD §12 — every kind cites a section of the spec that still exists.
//
// The register is the closed list of occasions the product may mail on.
// A row whose `occasionsFrom` names a section SPEC.md no longer has is a
// mail with no justification left — this suite fails before a customer
// finds out.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIL_KINDS, type MailKind } from "../../../src/lib/mail/kinds";

const BUILD = readFileSync(path.resolve(__dirname, "../../../SPEC.md"), "utf8");

/** Every numbered heading SPEC.md carries, e.g. `4.2`, `12`, `6.3a`. */
const SECTIONS = new Set(
  [...BUILD.matchAll(/^#{2,3} (\d+(?:\.\d+)?[a-z]?)\.? /gm)].map((m) => m[1] as string)
);

const CITED = /§(\d+(?:\.\d+)?[a-z]?)/g;

describe("BUILD §12 — every register row cites a live section", () => {
  it("SPEC.md was read and holds numbered sections", () => {
    expect(SECTIONS.size).toBeGreaterThan(10);
    expect(SECTIONS.has("12")).toBe(true);
  });

  it("every section a row cites resolves", () => {
    const dangling: string[] = [];
    for (const kind of Object.keys(MAIL_KINDS) as MailKind[]) {
      const ids = [...MAIL_KINDS[kind].occasionsFrom.matchAll(CITED)].map((m) => m[1] as string);
      expect(ids.length, `${kind} cites no section`).toBeGreaterThan(0);
      for (const id of ids) {
        if (!SECTIONS.has(id)) dangling.push(`${kind} → §${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("discriminates: a row citing a section SPEC.md does not have is caught", () => {
    const invented = [...("§99.9".matchAll(CITED))].map((m) => m[1] as string);
    expect(invented).toEqual(["99.9"]);
    expect(SECTIONS.has("99.9")).toBe(false);
  });
});
