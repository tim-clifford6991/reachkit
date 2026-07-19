import { describe, expect, test } from "vitest";
import { isGarbageFetch, visibleTextFromHtml } from "./fetch-quality";

/**
 * Part C — the garbage-fetch detector (the x.com class).
 *
 * Calibration note: this task has NO prod DB access (no read of the real
 * x.com/linear.app `raw_documents` capture), so the fixtures below are
 * hand-authored to the SHAPE those captures are known to have (from the
 * evidence in the task brief + the historical linear.app SEO=0 finding, not
 * from the literal bytes) — a CSR bootstrap shell (empty mount div + the
 * standard "enable javascript" noscript fallback) and a title that never
 * moved past the bare host. Each marker is documented with its rationale in
 * fetch-quality.ts. Do NOT overfit further fixtures to x.com specifically —
 * these encode the CLASS (any JS-shell site), not one domain.
 */

const HOST = "x.com";

// A realistic Vite/CRA-shape CSR bootstrap page: near-empty visible text, an
// empty `#root` mount node, and the universal noscript fallback. This is what
// `curl`-ing a client-rendered SPA (no headless browser) actually returns.
const SPA_SHELL_HTML = `<!doctype html>
<html>
<head><title>${HOST}</title><meta charset="utf-8"></head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
  <script src="/static/js/bundle.js"></script>
</body>
</html>`;

// Next.js-shape shell (the linear.app class): a real, non-host title, but the
// mount node is still empty pre-hydration — content lives only in the inline
// RSC payload (a <script> blob), which is not visible page text.
const NEXTJS_SHELL_HTML = `<!doctype html>
<html>
<head><title>Linear – Plan and build products</title></head>
<body>
  <div id="__next"></div>
  <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>
</body>
</html>`;

const HEALTHY_HTML = `<!doctype html>
<html>
<head>
  <title>Acme — Project tracking for small teams</title>
  <meta name="description" content="Acme helps small teams plan sprints, track issues, and ship on time.">
</head>
<body>
  <h1>Project tracking that keeps small teams shipping</h1>
  <p>Acme is a lightweight project tracker built for small teams who are tired of
  heavyweight tools. Plan your sprint in minutes, track issues without the
  ceremony, and see exactly what's blocking your release. Thousands of teams
  use Acme every day to ship faster, with less overhead than the big
  enterprise suites. Try it free for 14 days, no credit card required, and see
  why founders love how fast Acme gets out of your way so you can just ship.
  Onboarding takes five minutes and support is real humans, not a bot.</p>
  <h2>Why teams switch to Acme</h2>
  <p>Most project trackers are built for enterprises with dedicated admins.
  Acme is built for the other 99% of teams: no seat minimums, no six-week
  rollout, and no config maze before your first sprint. Import from your old
  tool in one click and keep the history that matters.</p>
</body>
</html>`;

describe("visibleTextFromHtml", () => {
  test("strips script/style/noscript before extracting text", () => {
    const text = visibleTextFromHtml(HEALTHY_HTML);
    expect(text).toContain("Project tracking that keeps small teams shipping");
    expect(text.length).toBeGreaterThan(400);
  });

  test("an empty-shell page yields near-zero visible text", () => {
    const text = visibleTextFromHtml(SPA_SHELL_HTML);
    // noscript is stripped (it's never shown to a JS-capable browser); the
    // only remaining text is nothing meaningful.
    expect(text.length).toBeLessThan(50);
  });
});

describe("isGarbageFetch — the primary site-fetch check (html + text + title + host)", () => {
  test("a healthy, content-rich page is NOT garbage", () => {
    const text = visibleTextFromHtml(HEALTHY_HTML);
    expect(
      isGarbageFetch({ html: HEALTHY_HTML, text, title: "Acme — Project tracking for small teams", host: "acme.io" }),
    ).toBe(false);
  });

  test("x.com-shape SPA shell: title equals bare host → garbage", () => {
    const text = visibleTextFromHtml(SPA_SHELL_HTML);
    expect(isGarbageFetch({ html: SPA_SHELL_HTML, text, title: HOST, host: HOST })).toBe(true);
  });

  test("title equals host case/whitespace-insensitively → garbage", () => {
    const text = visibleTextFromHtml(SPA_SHELL_HTML);
    expect(isGarbageFetch({ html: SPA_SHELL_HTML, text, title: "  X.COM  ", host: "x.com" })).toBe(true);
  });

  test("www-prefixed host still matches the bare-host title check", () => {
    const text = visibleTextFromHtml(SPA_SHELL_HTML);
    expect(isGarbageFetch({ html: SPA_SHELL_HTML, text, title: "x.com", host: "www.x.com" })).toBe(true);
  });

  // Isolates the title==host check from the marker checks (SPA_SHELL_HTML
  // above always also trips a marker, so a mutation that deletes JUST the
  // title==host branch would still pass every test above it).
  test("title==host in isolation (no markers, plenty of text) → garbage", () => {
    const html = `<html><head><title>acme.io</title></head><body><p>${"padding text ".repeat(40)}</p></body></html>`;
    const text = visibleTextFromHtml(html);
    expect(text.length).toBeGreaterThanOrEqual(400);
    expect(isGarbageFetch({ html, text, title: "acme.io", host: "acme.io" })).toBe(true);
  });

  test("empty title → garbage even with unrelated html/text", () => {
    expect(isGarbageFetch({ html: "<html></html>", text: "x".repeat(500), title: "", host: "acme.io" })).toBe(true);
  });

  test("visible text under 400 chars → garbage even with a real, distinct title", () => {
    expect(
      isGarbageFetch({ html: "<html></html>", text: "short", title: "Acme — Real Title", host: "acme.io" }),
    ).toBe(true);
  });

  test("exactly at the 400-char boundary is NOT garbage (< 400 is the rule, not <=)", () => {
    const text = "a".repeat(400); // 400 chars exactly, no trim-affecting whitespace
    expect(text.length).toBe(400);
    expect(isGarbageFetch({ html: "<html></html>", text, title: "Acme — Real Title", host: "acme.io" })).toBe(false);
  });

  test("linear.app-shape Next.js shell: real title, but empty __next mount → garbage (marker, not title)", () => {
    const text = visibleTextFromHtml(NEXTJS_SHELL_HTML);
    // Title is real and distinct from host — this page would pass the title
    // check and the length check could go either way, but the empty
    // mount-div marker must still catch it (the historical linear.app SEO=0
    // bug: real <title>, zero server-rendered content).
    expect(
      isGarbageFetch({ html: NEXTJS_SHELL_HTML, text, title: "Linear – Plan and build products", host: "linear.app" }),
    ).toBe(true);
  });

  // Isolates the empty-mount-div marker from the length/title checks (the
  // Next.js fixture above is ALSO caught by the length check on its own, since
  // its visible text is near-zero — a mutation that deleted just the marker
  // branch would still pass it). Padding text pushes length past the 400
  // floor while the mount div stays empty and no noscript marker is present.
  test("empty mount div in isolation (real title, plenty of OTHER text) → garbage", () => {
    const html = `<html><head><title>Linear – Plan and build products</title></head><body>
      <div id="__next"></div>
      <p>${"padding text ".repeat(40)}</p>
    </body></html>`;
    const text = visibleTextFromHtml(html);
    expect(text.length).toBeGreaterThanOrEqual(400);
    expect(
      isGarbageFetch({ html, text, title: "Linear – Plan and build products", host: "linear.app" }),
    ).toBe(true);
  });

  test("the noscript 'enable javascript' marker alone flags an otherwise-plausible page", () => {
    const html = `<html><head><title>Acme — Real Title</title></head><body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <p>${"padding text ".repeat(40)}</p>
    </body></html>`;
    const text = visibleTextFromHtml(html);
    expect(text.length).toBeGreaterThanOrEqual(400); // long enough to isolate the marker check
    expect(isGarbageFetch({ html, text, title: "Acme — Real Title", host: "acme.io" })).toBe(true);
  });

  test("marker match is case-insensitive", () => {
    const html = `<html><head><title>Acme — Real Title</title></head><body>
      <noscript>Please ENABLE JAVASCRIPT to continue.</noscript>
      <p>${"padding text ".repeat(40)}</p>
    </body></html>`;
    const text = visibleTextFromHtml(html);
    expect(isGarbageFetch({ html, text, title: "Acme — Real Title", host: "acme.io" })).toBe(true);
  });

  test("an empty div whose id is NOT a known mount name does not trip the marker", () => {
    const html = `<html><head><title>Acme — Real Title</title></head><body>
      <div id="sidebar"></div>
      <p>${"padding text ".repeat(40)}</p>
    </body></html>`;
    const text = visibleTextFromHtml(html);
    expect(isGarbageFetch({ html, text, title: "Acme — Real Title", host: "acme.io" })).toBe(false);
  });

  test("a mount div that HAS children (already hydrated/SSR'd) does not trip the marker", () => {
    const html = `<html><head><title>Acme — Real Title</title></head><body>
      <div id="root"><h1>Real content</h1><p>${"padding text ".repeat(40)}</p></div>
    </body></html>`;
    const text = visibleTextFromHtml(html);
    expect(isGarbageFetch({ html, text, title: "Acme — Real Title", host: "acme.io" })).toBe(false);
  });
});

describe("isGarbageFetch — re-checking escalated (Tavily Extract) content: title is not applicable", () => {
  test("omitting title skips the title==host/empty check — only length + markers apply", () => {
    const goodEscalatedText = "Real page content. ".repeat(30); // > 400 chars, no markers
    expect(goodEscalatedText.length).toBeGreaterThan(400);
    expect(isGarbageFetch({ html: goodEscalatedText, text: goodEscalatedText, host: HOST })).toBe(false);
  });

  test("short/empty escalated content is still garbage without a title", () => {
    expect(isGarbageFetch({ html: "", text: "", host: HOST })).toBe(true);
  });

  test("escalated content that itself contains a shell marker is still garbage without a title", () => {
    const text = "You need to enable JavaScript to run this app. " + "padding ".repeat(60);
    expect(isGarbageFetch({ html: text, text, host: HOST })).toBe(true);
  });
});
