// tests/account/checkout/no-vies.test.ts — BUILD §13, issue #33
//
// REQ-022 criterion 7: a buyer's purchase completes "whatever any registry
// would say about that number — no check against VIES or any other registry
// stands between them and their purchase."
//
// A source-level assertion, because the failure it guards against is a
// future addition rather than a present bug: somebody adding a VAT lookup
// in good faith, to be helpful, and turning a typo into a refused purchase.
// The whole directory is swept, so a new file inherits the rule.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CHECKOUT = path.resolve(import.meta.dirname, "../../../src/lib/account/checkout");
const PROVISIONING = path.resolve(import.meta.dirname, "../../../src/lib/account/provisioning");

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

const CHECKOUT_FILES = tsFilesUnder(CHECKOUT);
const ALL_FILES = [...CHECKOUT_FILES, ...tsFilesUnder(PROVISIONING)];

/** Comments stripped, on the footing `tests/config/constants.test.ts`
 *  already uses for its own `CopyKey` rule: the criterion is "no code here
 *  consults a registry", and a file that *says in prose* it consults none
 *  would otherwise fail its own promise. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("no VAT registry is consulted, and none may be added", () => {
  it.each(ALL_FILES)("%s names no VAT-validation service", (file) => {
    const source = code(file);
    expect(source).not.toMatch(/\bvies\b/i);
    expect(source).not.toMatch(/ec\.europa\.eu/);
    expect(source).not.toMatch(/vatlayer|vatstack|abstractapi/i);
  });

  it.each(ALL_FILES)("%s makes no network call of its own", (file) => {
    const source = code(file);
    // The one way out of this module is the vendor client. `fetch(`,
    // `https.request` and an XHR are all absent, and the eslint fence
    // `local/no-fetch-outside-egress` holds the first of the three besides.
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bhttps?\.(request|get)\s*\(/);
  });
});

describe('REQ-024 c5 — the chase "never asks for payment again"', () => {
  it("chase.ts imports nothing from the checkout module", () => {
    const source = code(path.join(PROVISIONING, "chase.ts"));
    expect(source).not.toMatch(/from\s+["'][^"']*checkout/);
  });

  it("chase.ts names no price key and builds no checkout URL", () => {
    const source = readFileSync(path.join(PROVISIONING, "chase.ts"), "utf8");
    expect(source).not.toMatch(/["'`]price\./);
    expect(source).not.toMatch(/createCheckoutSession|checkout\.stripe\.com/);
  });
});

describe('REQ-024 c6 — the backstop creates "no second charge"', () => {
  it("backstop.ts calls no charge and no checkout", () => {
    const source = code(path.join(PROVISIONING, "backstop.ts"));
    expect(source).not.toMatch(/charges\.|createCheckoutSession|sessions\.create/);
  });
});
