// tests/publish/verify/answer.test.ts — REQ-062 criterion 4's three
// outcomes, and ADR-085's whitelist.
//
// The discriminating row is the generated status sweep: a blacklist
// implementation ("anything that is not a 2xx is `page_not_found`, except
// this list") is indistinguishable from a whitelist on every hand-written
// fixture and fails only that. The consequence of getting it wrong is a
// page retired from weekly judgement for ever on the strength of a status
// nobody classified.
//
// The second discriminating pair is identity against readability: a
// JavaScript-gated page that declares itself is `found` — so the one check
// that exists to catch it can actually run — while a parked page with no
// canonical, no `og:url` and a rewritten title is `not_our_page`, though
// the two have indistinguishable body coverage (`coverage.test.ts` asserts
// that from its side).
//
// The archived plan is WO-261.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classify, isOurPage, type Answer } from "@/lib/publish/verify/answer";
import type { NotConfirmed } from "@/lib/publish/types";

const URL_ = "https://example.com/how-long-does-a-roof-last";
const TITLE = "How long does a roof last?";

const OUR_PAGE = `<!doctype html><html><head>
<title>How long does a roof last? — Example Roofing</title>
<link rel="canonical" href="${URL_}">
</head><body><h1>How long does a roof last?</h1><p>Eighty years.</p></body></html>`;

const JAVASCRIPT_GATED = `<!doctype html><html><head>
<title>How long does a roof last? — Example Roofing</title>
<link rel="canonical" href="${URL_}">
</head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;

const PARKED = `<!doctype html><html><head><title>example.com is for sale</title></head>
<body><h1>This domain may be for sale</h1></body></html>`;

function answer(over: Partial<Answer> = {}): Answer {
  return {
    status: 200,
    finalUrl: URL_,
    requestedUrl: URL_,
    html: OUR_PAGE,
    publishedTitle: TITLE,
    ...over,
  };
}

describe("classify — a whitelist of two statuses (REQ-062 c4, ADR-085)", () => {
  it("a 404 or a 410, and no other answer, is page_not_found", () => {
    for (const status of [404, 410] as const) {
      expect(classify(answer({ status, html: PARKED }))).toEqual({
        outcome: "page_not_found",
        status,
      });
    }
  });

  it("an unrecognised answer falls to could_not_confirm — every integer status in 100..599 outside {404, 410}", () => {
    // The property, not a list. It is not possible to write a blacklist
    // that passes this: the default arm must be the one that asserts
    // nothing, because `page_not_found` retires the page from judgement
    // for ever and `could_not_confirm` costs nothing.
    for (let status = 100; status <= 599; status += 1) {
      if (status === 404 || status === 410) continue;
      const result = classify(answer({ status, html: PARKED, finalUrl: URL_ }));
      expect(result.outcome, `status ${status}`).toBe("could_not_confirm");
    }
  });

  it("the site could not be reached is could_not_confirm", () => {
    expect(classify(answer({ status: null, finalUrl: null, html: null }))).toEqual({
      outcome: "could_not_confirm",
      why: "unreachable",
    });
  });

  it("a server error is could_not_confirm", () => {
    for (const status of [500, 502, 503, 599]) {
      expect(classify(answer({ status, html: "" }))).toEqual({
        outcome: "could_not_confirm",
        why: "server_error",
      });
    }
  });

  it("a redirect away from the page is could_not_confirm", () => {
    expect(
      classify(answer({ finalUrl: "https://example.com/blog", html: OUR_PAGE }))
    ).toEqual({ outcome: "could_not_confirm", why: "redirected_away" });
  });

  it("a document that is not the page ReachKit published is could_not_confirm", () => {
    expect(classify(answer({ html: PARKED }))).toEqual({
      outcome: "could_not_confirm",
      why: "not_our_page",
    });
  });

  it("a trailing slash is not a redirect away from the page", () => {
    // A CMS that answers at `…/` has not sent the reader anywhere else;
    // reading that as `redirected_away` would put a correctly published
    // page in the arm that asserts nothing about it.
    expect(classify(answer({ finalUrl: `${URL_}/` })).outcome).toBe("found");
  });

  it("no returned value names a cause or attributes anything", () => {
    // `NotConfirmed`'s four members are the whole vocabulary, and none of
    // them says who removed a page or that the customer did.
    const vocabulary: readonly NotConfirmed[] = [
      "unreachable",
      "server_error",
      "redirected_away",
      "not_our_page",
    ];
    const seen = new Set<string>();
    for (let status = 100; status <= 599; status += 1) {
      const result = classify(answer({ status, html: PARKED }));
      if (result.outcome === "could_not_confirm") seen.add(result.why);
    }
    for (const why of seen) expect(vocabulary).toContain(why as NotConfirmed);
    expect(classify(answer({ status: 404 }))).not.toHaveProperty("why");
    expect(classify(answer({ status: 404 }))).not.toHaveProperty("checks");
  });

  it("a 200 carrying our page is found and carries the document", () => {
    expect(classify(answer())).toEqual({ outcome: "found", html: OUR_PAGE });
  });
});

describe("isOurPage — identity decided apart from readability (BP-049 d4)", () => {
  it("a document whose canonical link resolves to the requested address is ours", () => {
    expect(isOurPage(OUR_PAGE, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(true);
  });

  it("a relative canonical resolves against the address that was asked for", () => {
    const html = `<html><head><link rel="canonical" href="/how-long-does-a-roof-last"></head><body></body></html>`;
    expect(isOurPage(html, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(true);
  });

  it("a document whose og:url resolves to the requested address is ours", () => {
    const html = `<html><head><meta property="og:url" content="${URL_}"><title>Anything at all</title></head></html>`;
    expect(isOurPage(html, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(true);
  });

  it("a document declaring neither, but whose normalised title matches, is ours", () => {
    const html = `<html><head><title>How long does a roof last? | Example Roofing</title></head></html>`;
    expect(isOurPage(html, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(true);
  });

  it("a document declaring a canonical that points elsewhere is not ours, and the title is not consulted", () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/other">
<title>How long does a roof last?</title></head></html>`;
    expect(isOurPage(html, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(false);
  });

  it("a document declaring none of the three is not our page", () => {
    expect(isOurPage(PARKED, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(false);
  });

  it("a JavaScript-gated page that declares itself is our page — and reaches `found`", () => {
    // Without this, the one check that exists to catch a JavaScript-gated
    // page would never run on one: it would disappear into `not_our_page`
    // and nothing would ever record the failure REQ-062 c1 promises.
    expect(isOurPage(JAVASCRIPT_GATED, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(true);
    expect(classify(answer({ html: JAVASCRIPT_GATED })).outcome).toBe("found");
  });

  it("a parked page with no canonical, no og:url and a rewritten title is not our page", () => {
    // Paired with the row above: the two fixtures have indistinguishable
    // body coverage and must land in different arms. Deciding identity from
    // coverage passes one and fails the other, whichever threshold is
    // chosen — the unfalsifiable gap BP-049 rejects.
    expect(isOurPage(PARKED, { requestedUrl: URL_, publishedTitle: TITLE })).toBe(false);
    expect(classify(answer({ html: PARKED })).outcome).toBe("could_not_confirm");
  });
});

describe("the module's own shape", () => {
  it("never imports bodyCoverage, and holds no fetch, clock or database", () => {
    // Comments are stripped first: the module header *names*
    // `bodyCoverage` in order to say it must not be reached for, and an
    // assertion over the raw file could only be satisfied by deleting the
    // explanation the next reader needs.
    const code = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/publish/verify/answer.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/bodyCoverage/);
    expect(code).not.toMatch(/from "\.\/coverage"/);
    expect(code).not.toMatch(/safeFetch|@\/lib\/egress|publishDb|new Date\(/);
  });

  it("is pure: the same answer classifies the same twice", () => {
    expect(classify(answer())).toEqual(classify(answer()));
  });
});
