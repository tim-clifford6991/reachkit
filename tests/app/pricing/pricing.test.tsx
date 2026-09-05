// tests/app/pricing/pricing.test.tsx — issue #19
//
// `src/app/(public)/pricing/page.tsx`'s own suite. Criteria are quoted
// verbatim from `archive/.../requirements/REQ-021.md`; line breaks are
// normalised to fit and no word is changed.
//
// **Rendering convention**, the one `tests/app/scan-address/landing.test.tsx`
// established and this file reuses: `tests/app/**` runs under Vitest's
// "node" project, so pages render through `react-dom/server`'s
// `renderToStaticMarkup`, and behaviour a static render cannot execute (the
// Server Function the submit posts to) is asserted against the module's own
// source, exactly as that file asserts the landing page's client half.
//
// **`copy()` is mocked to `(key) => key`** for the rendering tests, so they
// see the rendered *tree* — which key each line resolves from, how many
// controls there are — without depending on the owner's wording. The last
// describe drops the mock and renders against the real registry, which is
// where "this page does not throw on an owner-owed key" is proved.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { offerTerms } from "@/lib/presentation/offer";

// `page.tsx` reads `@/lib/config/env` at module load (BP-005) for the
// absolute `returnTo` it hands checkout, so the bindings are in place before
// the dynamic import below — `tests/mail/env-fixture.ts` is the corpus's one
// copy of them and is reused rather than transcribed a second time.
applyEnvFixture();

const PAGE_PATH = path.resolve(import.meta.dirname, "../../../src/app/(public)/pricing/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf8");

/** `PAGE_SOURCE` with every comment removed — block, line and JSX. The
 *  assertions below are about what the module *does*, and this file's own
 *  header quotes the very identifiers ("scanId", "€49") those assertions
 *  forbid in code. */
const PAGE_BODY = PAGE_SOURCE.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

/** Renders with `copy()` mocked to the identity, so an assertion names a
 *  key rather than a sentence. `isWritten` is mocked `true` for the same
 *  reason: these tests are about which lines the page carries, not about
 *  which the owner has written yet — that is the last describe's subject.
 *
 *  Rendered once and shared: the page takes no argument and is a pure
 *  function of the registry and `offerTerms()`, so a second render could
 *  only produce the same markup — at the cost of another `resetModules()`
 *  and a fresh import of the whole copy registry per test. */
let cachedKeyRender: Promise<string> | undefined;

function renderWithKeys(): Promise<string> {
  cachedKeyRender ??= renderWithKeysOnce();
  return cachedKeyRender;
}

async function renderWithKeysOnce(): Promise<string> {
  vi.resetModules();
  vi.doMock("@/lib/presentation/copy", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    copy: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
    isWritten: () => true,
  }));
  const { default: PricingPage } = (await import("@/app/(public)/pricing/page.tsx")) as {
    default: () => React.JSX.Element;
  };
  const html = renderToStaticMarkup(<PricingPage />);
  vi.doUnmock("@/lib/presentation/copy");
  return html;
}

describe('REQ-021 c4 — "Given a surface that offers ReachKit away from any report, when a founder reaches it, then it carries exactly one offer to subscribe, states the price on the terms REQ-022 criterion 1 fixes and what the subscription does on the same terms the offer at the end of a report states (criterion 2), and one control on it begins checkout with no account, sign-in, password or form asked first (REQ-020 criterion 1)." — pricing/offer', () => {
  it("exactly one offer and exactly one control", async () => {
    const html = await renderWithKeys();
    expect(html.match(/<div class="card"/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).toContain('type="submit"');
  });

  it("nothing is asked first — no field, no sign-in, no password", async () => {
    const html = await renderWithKeys();
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<textarea");
    expect(html.toLowerCase()).not.toContain("password");
    expect(html).not.toContain('href="/signin"');
  });

  it("the module reads no session, no cookie and no scan", () => {
    expect(PAGE_BODY).not.toMatch(/\bcookies\b|\bheaders\(\)/);
    expect(PAGE_BODY).not.toMatch(/currentSession|hasActiveAccess/);
    expect(PAGE_BODY).not.toMatch(/readCurrentReport|runScan/);
  });

  it("the terms are the report offer's terms — asserted against offerTerms(), never against a list here", async () => {
    const html = await renderWithKeys();
    const terms = offerTerms();
    // Every key the one derivation names appears, in its order; a row added
    // to `offerTerms()` renders here with no edit to the page or to this
    // assertion.
    const positions = [
      ...terms.priceKeys,
      ...terms.rows.map((r) => r.key),
      terms.cancelKey,
      terms.startKey,
    ].map((key) => html.indexOf(key));
    for (const [i, at] of positions.entries()) {
      expect(at, `key ${i} of offerTerms() is not rendered`).toBeGreaterThanOrEqual(0);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("each cadence row is filled from the row's own value, not from a number this page formats", async () => {
    const html = await renderWithKeys();
    for (const row of offerTerms().rows) {
      expect(html).toContain(`${row.key}:${row.value}`);
    }
  });
});

describe('REQ-021 c2 — "Given the offer, when it renders, then it states the monthly price on the terms REQ-022 criterion 1 fixes, how often a page is written, how often measurement is repeated, how often the customer is told what moved, that a page can be stopped before it publishes, and that the subscription can be cancelled by the customer themselves." — pricing/offer · every statement from a key', () => {
  it("the page holds no sentence, no currency symbol and no digit of its own", () => {
    expect(PAGE_BODY).not.toContain("€");
    // The page states no number of its own: the amount is inside the
    // owner's sentence, the cadences inside `offerTerms()`. Two things in
    // the body carry a digit and are not figures about the offer —
    // `Surface`'s column count, which is a layout declaration (ADR-093),
    // and a `className` spacing token, which is the same "class names, not
    // a sentence" category the copy sweep's own allow-list names. Both are
    // removed before the check rather than exempted by hand-waving.
    const withoutLayout = PAGE_BODY.replace(/count: 1/g, "").replace(/className="[^"]*"/g, "");
    expect(withoutLayout).not.toMatch(/[0-9]/);
  });

  it("the numeral the page does render is in JetBrains Mono (BUILD §2.3)", async () => {
    const html = await renderWithKeys();
    expect(html).toContain('<span class="num">price.amount</span>');
  });
});

describe('REQ-021 c5 — "Given a founder on a price surface with no report behind it, when they buy, then the purchase completes on the same terms as one made from a report." — pricing/checkout · the origin is pricing and carries no scan', () => {
  it("the one control posts a Server Function that names origin { kind: 'pricing' } exactly", () => {
    expect(PAGE_SOURCE).toContain('"use server"');
    expect(PAGE_SOURCE).toContain('origin: { kind: "pricing" }');
    expect(PAGE_SOURCE).toContain("createCheckoutSession");
  });

  it("no scan id is fabricated here: the page names no scanId at all", () => {
    expect(PAGE_BODY).not.toMatch(/scanId/);
    expect(PAGE_BODY).not.toMatch(/kind: "report"/);
  });

  it("returnTo is this surface's own absolute URL, built from NEXT_PUBLIC_APP_URL", () => {
    expect(PAGE_SOURCE).toContain("NEXT_PUBLIC_APP_URL");
    expect(PAGE_SOURCE).toContain('new URL("/pricing"');
  });

  it("a refused session is not swallowed: the page never renders as if checkout began", () => {
    expect(PAGE_SOURCE).toMatch(/if \(!result\.ok\)/);
    expect(PAGE_SOURCE).toMatch(/throw new Error/);
  });
});

describe("against the real registry — the two owner-owed sentences are left unsaid, not invented and not thrown on", () => {
  it("renders without throwing, speaks the seven ruled sentences, and leaves no blank in place of the two that are owed", async () => {
    vi.resetModules();
    const { default: PricingPage } = (await import("@/app/(public)/pricing/page.tsx")) as {
      default: () => React.JSX.Element;
    };
    const { COPY, copy, isWritten } = await import("@/lib/presentation/copy");
    const html = renderToStaticMarkup(<PricingPage />);

    // The seven the owner ruled on 2026-09-04, byte for byte.
    expect(html).toContain(COPY["price.amount"]);
    expect(html).toContain(COPY["price.interval"]);
    expect(html).toContain(COPY["offer.start"]);
    for (const row of offerTerms().rows) {
      expect(html).toContain(copy(row.key, { value: row.value }));
    }

    // The two still owner-owed. This assertion is derived from the registry,
    // not from a list here, so the day the owner writes either one it flips
    // to requiring it with no edit to this file or to the page.
    for (const key of ["price.vat_included", "offer.cancel_self_service"] as const) {
      if (isWritten(key)) {
        expect(html).toContain(COPY[key]);
      } else {
        // Not spoken — and not left as an empty element in its place.
        expect(html).not.toContain("<p></p>");
        expect(html).not.toContain("<span> </span>");
        expect(html).not.toContain("TODO");
      }
    }
  });
});
