// The repository is public: a fixture copied from a real site, or a real
// person's address in stored evidence, publishes someone else's data.
// Failures name the file and the domain, never the address.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
// Shipped copy is held to the same rule: a placeholder address is someone's inbox unless its domain is reserved.
const STORED = [
  "tests",
  "docs/walk",
  "scripts/panel/evidence",
  "scripts/eval-content/snapshot",
  "src/lib/presentation/copy/keys",
];
const HOMES = "tests/locale/fixtures/homes";
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|zip|gz)$/i;
const ADDRESS = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
// "logo@2x.png" names an asset, not a mailbox.
const ASSET = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const HOST = /(?:https?:)?\/\/([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

const reserved = (host: string): boolean =>
  /(^|\.)example\.((co|com|org|net|ac)\.)?[a-z]{2,}$/i.test(host) || /\.(example|test)$/i.test(host);

const files = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !BINARY.test(entry.name))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)))
    .filter((file) => !readFileSync(path.join(ROOT, file)).includes(0));

describe("fixtures, stored evidence and shipped copy are synthetic", () => {
  it("hold no email address outside example.*, *.example, *.test and reachkit.app", () => {
    const found = new Set<string>();
    for (const file of STORED.flatMap(files)) {
      for (const [, domain] of readFileSync(path.join(ROOT, file), "utf8").matchAll(ADDRESS)) {
        if (ASSET.test(domain!) || reserved(domain!) || domain!.toLowerCase() === "reachkit.app") continue;
        found.add(`${file}: ${domain!.toLowerCase()}`);
      }
    }
    expect([...found]).toEqual([]);
  });

  it("the locale home pages name only reserved hosts", () => {
    const found = new Set<string>();
    for (const file of files(HOMES)) {
      for (const [, host] of readFileSync(path.join(ROOT, file), "utf8").matchAll(HOST)) {
        if (!reserved(host!)) found.add(`${file}: ${host!.toLowerCase()}`);
      }
    }
    expect([...found]).toEqual([]);
  });

  it("the rule is written in PROCESS", () => {
    expect(readFileSync(path.join(ROOT, "docs/PROCESS.md"), "utf8")).toContain(
      "New fixtures are synthetic: no copied third-party page, no real person's address. Stored panel evidence holds no email address."
    );
  });
});
