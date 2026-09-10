// tests/app/scan-address/landing.test.tsx
//
// WO-070 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-001.md` and `requirements/REQ-093.md`) — the one-control, no-gate,
// error-in-place and no-JavaScript suites for `src/app/(public)/page.tsx`.
//
// **Rendering convention**: `tests/app/**` runs under Vitest's "node"
// project (`vitest.config.ts` — jsdom is `tests/ui/**`'s only), so this
// file renders with `react-dom/server`'s `renderToStaticMarkup`, exactly
// as `tests/app/layout.test.ts` renders `RootLayout` — no simulated
// browser event, no `fireEvent`. The page's own client behaviour
// (`fetch`, `window.location.assign`, the `onSubmit` handler) is asserted
// by source, the same convention `tests/app/scan-address/api-scan.test.ts`
// uses for `route.ts`'s own wiring it cannot execute end to end either.
//
// **`copy()` is mocked to `(key) => key`** for every rendering test below,
// regardless: mocking lets these suites see the rendered *tree* — control
// count, value survival, which key a line resolves from — without
// depending on the owner's own wording either way.
//
// Of this WO's eight copy keys (`src/lib/presentation/copy/keys/report.ts`,
// WO-070's Modify row), all eight are now filled: `landing.headline`,
// `landing.field.label`, `landing.submit.label` were filled 2026-09-03 by
// the owner's ruling (WO-070 `## Log`, "landing copy approved"), and the
// five `landing.problem.*` lines were filled 2026-09-04 by the owner's
// ruling (WO-070 `## Log`, this date's ruling). None is owner-owed and
// none throws against the real (unmocked) registry any longer. That all
// eight resolve, and resolve to exactly the owner's strings, is proved
// once, directly against `copy.ts`, in the describe block below (mirroring
// WO-249's "asserts the key reached, never the sentence").
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({ copy: (key: string) => key }));

// Issue #438 — the route hands the free pass to `after()`, which throws
// outside a request scope. Stood in here so the no-JavaScript suite below
// can still call `POST` directly; the task is recorded and never run, so
// no pipeline is started by a suite about a rendered page.
vi.mock("next/server", () => ({ after: () => undefined }));

import { POST } from "@/app/api/scan/route";

vi.mock("@/lib/scan/admission", () => ({
  networkKeyOf: vi.fn(),
  claimFreeScanSlot: vi.fn(),
}));
import { networkKeyOf, claimFreeScanSlot } from "@/lib/scan/admission";
import type { NetworkKey } from "@/lib/scan/admission";

const PAGE_PATH = path.resolve(import.meta.dirname, "../../../src/app/(public)/page.tsx");
const PAGE_SOURCE = readFileSync(PAGE_PATH, "utf8");
// 2026-09-07, issue #266: the page became a Server Component so the hero's
// specimen could be the report's own component over the reserved fixture,
// and the one interactive part — the field, its control and the two
// transports — moved into `_landing/ScanForm.tsx` unchanged. The assertions
// that read the *mechanism* read it there; the ones that read what the page
// renders still render the page, which is the half that matters and the
// half that did not move.
const FORM_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/(public)/_landing/ScanForm.tsx"
);
const FORM_SOURCE = readFileSync(FORM_PATH, "utf8");

const NETWORK = "network-key-fixture" as NetworkKey;

beforeEach(() => {
  vi.mocked(networkKeyOf).mockReturnValue(NETWORK);
  vi.mocked(claimFreeScanSlot).mockResolvedValue({ claimed: true, scanId: "claimed-scan-id" });
});

afterEach(() => {
  vi.mocked(networkKeyOf).mockReset();
  vi.mocked(claimFreeScanSlot).mockReset();
});

// The five DomainProblem handles this page must carry a line for
// (`src/lib/scan/domain.ts`, WO-051) — transcribed here as plain string
// literals (a TS type carries nothing at runtime), on the same terms
// `api-scan.test.ts` already transcribes them.
const DOMAIN_PROBLEMS = ["empty", "not_a_hostname", "ip_literal", "no_public_suffix", "too_long"] as const;

function postForm(fields: Record<string, string>): Request {
  const form = new URLSearchParams(fields);
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

function postJson(value: string): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

async function renderPage(searchParams: { problem?: string; value?: string } = {}): Promise<string> {
  vi.resetModules();
  const { default: LandingPage } = (await import("@/app/(public)/page.tsx")) as {
    default: (p: { searchParams: { problem?: string; value?: string } }) => React.JSX.Element;
  };
  // `React.createElement`, not a bare function call: `LandingPage` uses
  // hooks (`useState`, `use`), which only run under React's own dispatcher
  // — set up by `renderToStaticMarkup` walking a real element, not by
  // invoking the component as a plain function (the convention
  // `tests/app/layout.test.ts` uses for `RootLayout`, which owns no hook).
  return renderToStaticMarkup(React.createElement(LandingPage, { searchParams }));
}

/** Every native form-control tag in a static-markup string, by kind. */
function controlsOf(markup: string): {
  inputs: string[];
  buttons: string[];
  submits: string[];
  selects: string[];
  textareas: string[];
} {
  const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  return {
    inputs: [...markup.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]),
    buttons,
    // **What c1 counts is a submit control**, and the distinction is the
    // one the approved screen set made load-bearing (issue #351). The page
    // now draws a second and a third `<button>` — the header's CTA and the
    // closing CTA — and neither submits anything: REQ-099 c3 fixes them as
    // controls that "bring that one field into view with the cursor in it,
    // ready to type, without a page load and without adding a second input
    // or a second submit control", and ruling 2b of 2026-09-08 says the
    // same thing from the other side. So the count that has to stay at one
    // is this one, and the assertion below that every other button is
    // `type="button"` is what keeps the two readings from drifting apart.
    submits: buttons.filter((b) => /type="submit"/.test(b)),
    selects: [...markup.matchAll(/<select\b[^>]*>/g)].map((m) => m[0]),
    textareas: [...markup.matchAll(/<textarea\b[^>]*>/g)].map((m) => m[0]),
  };
}

// ── REQ-001 c1 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c1 — "Given a visitor on the landing page, when the page renders, then it presents exactly one text input and one submit control and no other input control of any kind — no market, competitor, keyword or country field, selector or toggle, optional or required — and no sign-in or payment is required before submitting."',
  () => {
    it("landing/controls · exactly one input and one submit, and nothing else", async () => {
      const markup = await renderPage();
      const { inputs, buttons, submits, selects, textareas } = controlsOf(markup);

      expect(inputs).toHaveLength(1);
      expect(inputs[0]).toMatch(/type="text"/);
      expect(inputs[0]).not.toMatch(/type="(checkbox|radio|email|password|number|hidden)"/);

      // Exactly one submit control, and every other button on the page is
      // REQ-099 c3's — a control that focuses this same field.
      expect(submits).toHaveLength(1);
      for (const button of buttons) {
        if (submits.includes(button)) continue;
        expect(button, "a second control that is not a submit must say so").toMatch(
          /type="button"/
        );
      }

      expect(selects).toHaveLength(0);
      expect(textareas).toHaveLength(0);
    });

    it("landing/controls · no gate before submitting", async () => {
      const markup = await renderPage();

      expect(markup).not.toMatch(/sign[- ]?in/i);
      expect(markup).not.toMatch(/type="email"/);
      // Text only. The idiom's boxes carry a `card` class name (issue
      // #266) and a class name is not something a visitor is asked for —
      // what this refuses is the *word* on the screen.
      const visible = markup.replace(/<[^>]*>/g, " ");
      expect(visible).not.toMatch(/payment|card|checkout/i);

      // 2026-09-07, issue #266: this read `not.toMatch(/<a href/)` — no
      // anchor at all — and the page now carries one, the how-to-start
      // section's CTA, which points at the page's own field. So the
      // assertion says what it always meant: **no anchor that gates**.
      // Every anchor on this page is an in-page one; a link that left for a
      // sign-in, a price or a checkout is what c1 and c10 refuse, and the
      // three assertions above already name those by their words.
      const hrefs = [...markup.matchAll(/<a\b[^>]*href="([^"]*)"/gi)].map((m) => m[1]);
      for (const href of hrefs) {
        expect(href, `${href} leaves the page before the visitor has submitted`).toMatch(/^#/);
      }

      // Source assertion: page.tsx imports no session, auth or account
      // module (WO-062's own convention for the same property on route.ts),
      // and never touches `document.cookie` — the only way a Client
      // Component could set one itself.
      // Both files: the promise is the *page's*, and half of it now lives
      // in the form.
      for (const source of [PAGE_SOURCE, FORM_SOURCE]) {
        expect(source).not.toMatch(/from\s+["'][^"']*\b(session|auth|account)\b[^"']*["']/i);
        expect(source).not.toMatch(/document\.cookie/);
      }
    });
  }
);

// ── REQ-001 c3 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c3 — "Given a visitor who submits a value that is not a well-formed public domain name — an empty value, an IP literal, or a hostname with no public suffix — when they submit, then one written line names what is wrong with the value and the visitor stays on the landing page with their input intact. A well-formed domain is accepted here whether or not it resolves; a domain that cannot be reached is a failed scan (REQ-003), not a rejected input."',
  () => {
    it.each([
      ["empty", ""],
      ["ip_literal", "203.0.113.5"],
      ["no_public_suffix", "localhost"],
    ] as const)("landing/error · the line names the problem and the value survives — %s", async (problem, value) => {
      const markup = await renderPage({ problem, value });
      const { inputs, submits } = controlsOf(markup);

      // Still exactly one input and one submit — the error state adds no
      // control (REQ-001 c1 continues to hold on the error render).
      expect(inputs).toHaveLength(1);
      expect(submits).toHaveLength(1);

      // The value survives, verbatim, in the input's value attribute.
      expect(markup).toContain(`value="${value}"`);

      // One written line, resolved from that DomainProblem's own key.
      const key = `landing.problem.${problem.replace(/_/g, "-")}`;
      expect(markup).toContain(key);
    });

    it("landing/error · the three lines are distinct", async () => {
      const lines = await Promise.all(
        (["empty", "ip_literal", "no_public_suffix"] as const).map(async (problem) => {
          const markup = await renderPage({ problem, value: "x" });
          const match = markup.match(/text-error">([^<]*)</);
          return match?.[1];
        })
      );
      expect(new Set(lines).size).toBe(3);
    });

    it("landing/error · a well-formed unresolvable domain is not rejected here", async () => {
      const res = await POST(postJson("this-domain-does-not-resolve-anywhere.example.com"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: true; location: string };
      expect(body.ok).toBe(true);
      expect(body.location).toBe("/scan/this-domain-does-not-resolve-anywhere.example.com");
    });
  }
);

// ── REQ-001 c2 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c2 — "Given a visitor who enters a domain in any of its written forms … when they submit, then they arrive at the single public report address for that domain; no two of those forms produce different addresses or different stored reports."',
  () => {
    it.each([
      "example.com",
      "http://example.com",
      "https://example.com",
      "www.example.com",
      "https://www.EXAMPLE.com/some/path",
      "EXAMPLE.COM.",
    ])("landing/submit · every written form lands on the one address — %s", async (form) => {
      const res = await POST(postJson(form));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: true; location: string };
      expect(body.location).toBe("/scan/example.com");
    });
  }
);

// ── REQ-001 c3, the no-JavaScript half ────────────────────────────────

describe(
  'REQ-001 c3, the no-JavaScript half — "… the visitor stays on the landing page with their input intact."',
  () => {
    it("landing/no-js · the promise holds without a client runtime", async () => {
      // A valid submission follows WO-062's 303 to the canonical address —
      // asserted directly against the handler this page's plain <form>
      // posts to, with no rendering involved (there is nothing to render:
      // the visitor has already left the landing page).
      const validRes = await POST(postForm({ value: "example.com" }));
      expect(validRes.status).toBe(303);
      const validLocation = new URL(validRes.headers.get("location") ?? "", "http://localhost");
      expect(validLocation.pathname).toBe("/scan/example.com");

      // An invalid submission returns to "/" carrying `problem` and
      // `value` (WO-062's own query-param convention) — this page's own
      // SSR markup, from those exact params, carries the line and the
      // value intact.
      const invalidRes = await POST(postForm({ value: "203.0.113.5" }));
      expect(invalidRes.status).toBe(303);
      const invalidLocation = new URL(invalidRes.headers.get("location") ?? "", "http://localhost");
      expect(invalidLocation.pathname).toBe("/");
      const problem = invalidLocation.searchParams.get("problem") ?? undefined;
      const value = invalidLocation.searchParams.get("value") ?? undefined;
      expect(problem).toBe("ip_literal");
      expect(value).toBe("203.0.113.5");

      const markup = await renderPage({ problem, value });
      expect(markup).toContain('value="203.0.113.5"');
      expect(markup).toContain("landing.problem.ip-literal");
    });

    it("landing/no-js · the <form> itself is a plain post to /api/scan, with no JavaScript required to reach it", () => {
      expect(FORM_SOURCE).toMatch(/<form\s+action="\/api\/scan"\s+method="post"/);
      // The one field carries the native `name` a plain HTML submission
      // needs (`src/ui/components/Input.tsx`'s WO-070 addition).
      expect(FORM_SOURCE).toMatch(/name="value"/);
      // preventDefault() is what turns the native submission into the
      // JavaScript path — its presence does not remove the native
      // action/method above, which is what a client with no runtime
      // falls back to.
      expect(FORM_SOURCE).toMatch(/preventDefault\(\)/);
    });
  }
);

// ── REQ-001 c10 ────────────────────────────────────────────────────────

describe(
  'REQ-001 c10 — "… nothing is asked of them at any point between the domain they gave and the report they read — no account, sign-in, email address, or payment, and no further field. …"',
  () => {
    it("landing/no-ask · nothing is asked on the way in", async () => {
      const markup = await renderPage();
      const { inputs, submits, selects, textareas } = controlsOf(markup);
      expect(inputs).toHaveLength(1);
      expect(submits).toHaveLength(1);
      expect(selects).toHaveLength(0);
      expect(textareas).toHaveLength(0);

      // The navigation that follows a valid submission: on `ok: true` the
      // JS path assigns `window.location` to the returned address and
      // returns immediately — no state is set and nothing else renders in
      // between (source assertion: the `ok` branch's only statements are
      // the navigation and the return).
      const okBranch = FORM_SOURCE.match(/if \(body\.ok\) \{([\s\S]*?)\}/);
      expect(okBranch, "no `if (body.ok)` branch found").toBeTruthy();
      expect(okBranch![1]).toMatch(/window\.location\.assign\(body\.location\)/);
      expect(okBranch![1]).toMatch(/return;/);
      expect(okBranch![1]).not.toMatch(/setProblem|setValue/);
    });
  }
);

// ── REQ-093 c1 ─────────────────────────────────────────────────────────

describe('REQ-093 c1 (BP-022: "This node contains no string literal a person reads")', () => {
  it("landing/copy · every sentence is a key", () => {
    // Every prop that renders visible text is a copy() call, never a
    // string literal.
    expect(PAGE_SOURCE).not.toMatch(/\blabel=["'][^{]/);
    expect(PAGE_SOURCE).not.toMatch(/\bplaceholder=["'][^{]/);
    expect(PAGE_SOURCE).not.toMatch(/\binvalidMessage=["'][^{]/);
    expect(PAGE_SOURCE).toMatch(/<h1[^>]*>\{copy\(["']landing\.headline["']\)\}<\/h1>/);

    // No bare JSX text node outside a `{…}` expression, scoped to the
    // component's own returned JSX (the slice from `return (` to the
    // matching `);`) rather than the whole file — the whole-file scan
    // would also match TypeScript generics like `Promise<T>`, which are
    // `>`…`<` pairs with nothing to do with rendered text.
    const returnBlock = PAGE_SOURCE.slice(PAGE_SOURCE.indexOf("return (\n    <Surface"));
    expect(returnBlock.length, "the JSX return block was not found").toBeGreaterThan(0);
    const jsxTextNodes = [...returnBlock.matchAll(/>([^<{}\n]+)</g)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
    expect(jsxTextNodes).toEqual([]);

    // Every visible string resolves through copy(): the three non-problem
    // keys are called directly by name; the five DomainProblem lines are
    // called through `PROBLEM_COPY_KEY[problem]` — a lookup, not a
    // literal — so each of those five is checked as a value in that map
    // instead, and the lookup call site is checked once.
    // The headline is the page's; the field's two are the form's since
    // #266 split them. Both files are read, so the property is the same one
    // and neither half can quietly start writing a sentence.
    const BOTH = `${PAGE_SOURCE}\n${FORM_SOURCE}`;
    for (const key of ["landing.headline", "landing.field.label", "landing.submit.label"]) {
      expect(BOTH, `copy() never reaches "${key}"`).toMatch(
        new RegExp(`copy\\(["']${key.replace(/[.-]/g, "\\$&")}["']`)
      );
    }
    expect(FORM_SOURCE).toMatch(/copy\(PROBLEM_COPY_KEY\[problem\]\)/);
    for (const key of [
      "landing.problem.empty",
      "landing.problem.not-a-hostname",
      "landing.problem.ip-literal",
      "landing.problem.no-public-suffix",
      "landing.problem.too-long",
    ]) {
      expect(FORM_SOURCE, `"${key}" is not a value in PROBLEM_COPY_KEY`).toContain(`"${key}"`);
    }
  });
});

// The owner's exact strings for the five `landing.problem.*` keys
// (2026-09-04 ruling, WO-070 `## Log`) — transcribed byte-exact from the
// ruling's canonical source, never retyped by eye, on the same terms the
// three 2026-09-03 strings below were entered into
// `src/lib/presentation/copy/keys/report.ts`.
const OWNER_PROBLEM_LINES: Record<string, string> = {
  "landing.problem.empty": "Type your website’s address first — for example, example.com.",
  "landing.problem.not-a-hostname": "That doesn’t look like a website address. Try the form example.com.",
  "landing.problem.ip-literal":
    "That’s a numeric address, not a website name. Type the name people visit, like example.com.",
  "landing.problem.no-public-suffix": "That address is missing its ending — try example.com rather than example.",
  "landing.problem.too-long": "That’s longer than any website address can be — check for extra text pasted in.",
};

describe('ADR-093 decision 6 — "every screen root is a `Surface`" (issue #62)', () => {
  it("landing/surface · the rendered page has exactly one [data-surface] root, with all three arms, and <main> inside it", async () => {
    const markup = await renderPage();
    const surfaces = markup.match(/<div data-surface=""[^>]*>/g) ?? [];
    expect(surfaces).toHaveLength(1);
    expect(markup.startsWith(surfaces[0]!)).toBe(true);
    expect(surfaces[0]).toMatch(/data-arm-compact="[^"]+"/);
    expect(surfaces[0]).toMatch(/data-arm-medium="[^"]+"/);
    expect(surfaces[0]).toMatch(/data-arm-wide="[^"]+"/);
    expect(markup).toMatch(/^<div data-surface=""[^>]*><main[^>]*>/);
    expect(markup.endsWith("</main></div>")).toBe(true);
  });
});

describe("WO-070 — all eight landing keys are supplied; none is owner-owed", () => {
  it("landing/copy · all eight landing keys resolve through the real (unmocked) registry and return exactly the owner's strings", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/presentation/copy");
    const { copy: realCopy } = await import("@/lib/presentation/copy/copy.ts");

    // The three keys ruled 2026-09-03 (WO-070 `## Log`, "landing copy
    // approved").
    expect(realCopy("landing.headline" as never)).toBe(
      "See what AI tells buyers about your market — and write your way in."
    );
    expect(realCopy("landing.field.label" as never)).toBe("Your website");
    expect(realCopy("landing.submit.label" as never)).toBe("Scan my site");

    // The five `landing.problem.*` keys ruled 2026-09-04, one per
    // `DomainProblem` handle — none throws, and each returns the owner's
    // exact sentence.
    const keys = DOMAIN_PROBLEMS.map((p) => `landing.problem.${p.replace(/_/g, "-")}`);
    expect(keys).toHaveLength(5);
    for (const key of keys) {
      let resolved: string | undefined;
      expect(() => {
        resolved = realCopy(key as never);
      }).not.toThrow();
      expect(resolved).toBe(OWNER_PROBLEM_LINES[key]);
    }

    // Discriminating against drift: every resolved problem line is
    // non-empty and the five are pairwise distinct, so an emptied key or
    // two keys collapsed onto one string would fail here even if each
    // individually happened to match its own `OWNER_PROBLEM_LINES` entry
    // by coincidence.
    const resolvedLines = keys.map((key) => realCopy(key as never));
    expect(resolvedLines.every((line) => line.length > 0)).toBe(true);
    expect(new Set(resolvedLines).size).toBe(5);
  });
});
