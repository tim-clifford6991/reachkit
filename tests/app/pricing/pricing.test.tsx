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
// **The offer itself is not re-tested here.** It is `PricingCard`, BUILD
// §4.1 module 6, and its own suite is the report screen's (issue #13). What
// this file owns is what REQ-021 criterion 4 asks of the *scanless* surface:
// that it carries that one offer and no second one, that nothing is asked
// first, and that the one control begins checkout with `origin: 'pricing'`
// and no fabricated scan id. Where a term must be shown to be "on the same
// terms the offer at the end of a report states", the assertion is that both
// surfaces render the same component — not that two lists match.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";

// `page.tsx` reads `@/lib/config/env` at module load (BP-005) for the
// absolute `returnTo` it hands checkout, so the bindings are in place before
// the dynamic import below — `tests/mail/env-fixture.ts` is the corpus's one
// copy of them and is reused rather than transcribed a second time.
applyEnvFixture();

const PAGE_PATH = path.resolve(import.meta.dirname, "../../../src/app/(public)/pricing/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf8");
const CARD_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/(public)/scan/[domain]/_modules/pricing.tsx"
);
const REPORT_VIEW_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/(public)/scan/[domain]/_address/report-view.tsx"
);

/** `PAGE_SOURCE` with every comment removed — block, line and JSX. The
 *  assertions below are about what the module *does*, and this file's own
 *  header quotes the very identifiers ("scanId") those assertions forbid in
 *  code. */
const PAGE_BODY = PAGE_SOURCE.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

/** Rendered once and shared: the page takes no argument and is a pure
 *  function of the registry, so a second render could only produce the same
 *  markup at the cost of another `resetModules()` and a fresh import of the
 *  whole copy registry. */
let cachedRender: Promise<string> | undefined;

function render(): Promise<string> {
  cachedRender ??= renderOnce();
  return cachedRender;
}

async function renderOnce(): Promise<string> {
  vi.resetModules();
  const { default: PricingPage } = (await import("@/app/(public)/pricing/page.tsx")) as {
    default: () => React.JSX.Element;
  };
  return renderToStaticMarkup(<PricingPage />);
}

describe('REQ-021 c4 — "Given a surface that offers ReachKit away from any report, when a founder reaches it, then it carries exactly one offer to subscribe, states the price on the terms REQ-022 criterion 1 fixes and what the subscription does on the same terms the offer at the end of a report states (criterion 2), and one control on it begins checkout with no account, sign-in, password or form asked first (REQ-020 criterion 1)." — pricing/offer', () => {
  it("exactly one offer and exactly one control", async () => {
    const html = await render();
    expect(html.match(/class="card[ "]/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).toContain('type="submit"');
  });

  it("nothing is asked first — no field, no sign-in, no password", async () => {
    const html = await render();
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

  it("the terms are the report offer's terms — the same component, not a second list", () => {
    // The discriminating assertion for "on the same terms": both surfaces
    // render `PricingCard`, and this page states no term of its own.
    //
    // Since the master's review of 2026-09-09 the card states S4's own
    // wording of the four terms on this surface — `terms="pricing"`, the
    // component's own discriminant, not a second list. The four *facts* are
    // the same four either way, which is what criterion 4 asks; which of the
    // two approved sentences states each is which screen is speaking.
    //
    // `offer.start` is **not** in the list since #369. It is no longer one
    // of the card's terms — the control there carries the price now, and
    // says so through `offer.start.priced` — so the two words are spoken
    // exactly once on this page, as the eyebrow above the heading, which is
    // where the approved set draws them (UI-SPEC S4). The rule the row
    // holds is unchanged: no term the card states is restated here.
    expect(PAGE_BODY).toContain("PricingCard");
    expect(readFileSync(REPORT_VIEW_PATH, "utf8")).toContain("PricingCard");
    for (const term of [
      "price.amount",
      "price.interval",
      "offer.cadence",
      "offer.veto",
      "offer.start.priced",
      "offer.cancel",
    ]) {
      expect(PAGE_BODY, `${term} is restated on this surface instead of coming from the card`).not.toContain(term);
    }
  });

  it("every sentence the surface speaks resolves through copy() in that one component", async () => {
    const html = await render();
    const { copy } = await import("@/lib/presentation/copy");
    const { VETO } = await import("@/lib/config/constants");
    expect(html).toContain(copy("price.amount"));
    expect(html).toContain(copy("price.interval"));
    expect(html).toContain(copy("offer.start"));
    // The four spec rows, in S4's own words (ruling 11a — the approved set
    // draws them unbracketed). Each is a registry key, not a literal here:
    // the assertion is that this surface speaks the pricing wording and not
    // the report's, and the veto line still carries the pin from
    // `constants.ts` through its slot.
    expect(html).toContain(copy("offer.pricing.page"));
    expect(html).toContain(copy("offer.pricing.measure"));
    expect(html).toContain(copy("offer.pricing.movement"));
    expect(html).toContain(copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }));
    expect(html).not.toContain(
      copy("offer.veto.window", {
        value: copy("offer.veto.window.value", { hours: String(VETO.defaultHours) }),
      })
    );
    // The card holds every string; this page's own body holds none.
    expect(PAGE_BODY).not.toContain("€");
  });
});

describe('REQ-021 c5 — "Given a founder on a price surface with no report behind it, when they buy, then the purchase completes on the same terms as one made from a report." — pricing/checkout · the origin is pricing and carries no scan', () => {
  it("the one control posts a Server Function that names origin { kind: 'pricing' } exactly", () => {
    expect(PAGE_SOURCE).toContain('"use server"');
    expect(PAGE_BODY).toContain('origin: { kind: "pricing" }');
    expect(PAGE_BODY).toContain("createCheckoutSession");
  });

  it("no scan id is fabricated here: the page names no scanId at all", () => {
    expect(PAGE_BODY).not.toMatch(/scanId/);
    expect(PAGE_BODY).not.toMatch(/kind: "report"/);
  });

  it("returnTo is this surface's own absolute URL, built from NEXT_PUBLIC_APP_URL", () => {
    expect(PAGE_BODY).toContain("NEXT_PUBLIC_APP_URL");
    expect(PAGE_BODY).toContain('new URL("/pricing"');
  });

  it("a refused session is not swallowed: the page never renders as if checkout began", () => {
    expect(PAGE_BODY).toMatch(/if \(!result\.ok\)/);
    expect(PAGE_BODY).toMatch(/throw new Error/);
  });

  it("the report's own offer is unchanged: with no startAction the card renders its control bare", () => {
    // `startAction` is additive. The report screen passes nothing, and must
    // still get a control that is not wrapped in a form of this page's.
    const card = readFileSync(CARD_PATH, "utf8");
    expect(card).toContain("startAction?: () => Promise<void>");
    expect(card).toMatch(/p\.startAction \?/);
    expect(readFileSync(REPORT_VIEW_PATH, "utf8")).toContain("<PricingCard />");
  });
});

describe("the screen root (ADR-093; DECISIONS 2026-09-02)", () => {
  it("is one Surface with an arm declared for every band", async () => {
    const html = await render();
    expect(html.match(/data-surface=""/g)).toHaveLength(1);
    expect(html).toContain('data-arm-compact="columns:1"');
    expect(html).toContain('data-arm-medium="same-as-below"');
    expect(html).toContain('data-arm-wide="same-as-below"');
  });
});
