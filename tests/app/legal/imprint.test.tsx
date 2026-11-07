// tests/app/legal/imprint.test.tsx — the operator is named once, and every legal surface and mail says the same.
import "../../generate/env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "@/lib/presentation/copy";
import ImprintPage from "@/app/(public)/imprint/page.tsx";

const SRC = path.resolve(import.meta.dirname, "../../../src");

/** The imprint's Operator list: the name line, then the address lines. */
function operator(): { name: string; address: string[] } {
  const body = COPY["legal.imprint.body"];
  const block = body.slice(body.indexOf("**Operator**"), body.indexOf("**Contact**"));
  const [first = "", ...address] = [...block.matchAll(/^- (.+)$/gm)].map((m) => m[1] ?? "");
  return { name: first.replace(/, trading as ReachKit$/, ""), address };
}

describe("the imprint is written, and every surface names the same operator", () => {
  it("no legal or mail-shell value carries a placeholder", () => {
    const keys = Object.keys(COPY).filter((k) => k.startsWith("legal.") || k.startsWith("mail.shell."));
    expect(keys).toContain("mail.shell.imprint");
    for (const key of keys) expect(COPY[key as keyof typeof COPY], key).not.toMatch(/\[\[|⟨/);
  });

  it("no source file still carries an imprint placeholder", () => {
    const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((f) => /\.(ts|tsx)$/.test(f));
    const hits = files.filter((f) => readFileSync(path.join(SRC, f), "utf8").includes("[[imprint:"));
    expect(hits).toEqual([]);
  });

  it("the mail footer, the Terms party and the privacy controller read the imprint's name and address", () => {
    const { name, address } = operator();
    expect(name).not.toBe("");
    expect(address.length).toBeGreaterThanOrEqual(3);
    expect(COPY["mail.shell.imprint"]).toBe(`${name} · ${address.join(", ")}`);
    const party = `${name}, trading as ReachKit, ${address.join(", ")}`;
    expect(COPY["legal.terms.body"]).toContain(party);
    expect(COPY["legal.privacy.body"]).toContain(party);
  });

  it("/imprint shows the operator, the address, the email and the phone", () => {
    const html = renderToStaticMarkup(<ImprintPage />);
    const { name, address } = operator();
    for (const line of [name, ...address, "hello@reachkit.app"]) expect(html).toContain(line);
    expect(html).toMatch(/Phone: \+\d[\d ]+/);
  });
});
