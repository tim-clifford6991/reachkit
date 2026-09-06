// tests/app/scan-address/removal.test.tsx
//
// BUILD §4.1 · REQ-002 — the removal address on every report, the one
// written line a removed address serves, and the 410 the owner ruled on
// 2026-09-05 (#28). Criteria quoted verbatim from
// `archive/sdlc-factory-2026-09-04/corpus/docs/requirements/REQ-002.md`
// and `REQ-001.md`; carries WO-067's test plan, which WO-282 superseded.
//
// **Rendering convention**: `tests/app/**` runs under Vitest's `node`
// project, so this file renders with `react-dom/server`'s
// `renderToStaticMarkup`, the same convention
// `tests/app/scan-address/landing.test.tsx` uses.
//
// **`copy()` is NOT mocked here.** All three keys this surface reads were
// filled by the owner on 2026-09-04 and none is owner-owed, and two of the
// four criteria below are about the *sentence* reaching the screen intact
// — that the address a removed page names is the same address a live
// report names cannot be proved against a `(key) => key` stub, because a
// stub makes every key its own distinct answer. The suites therefore
// assert against the real registry and compare resolved strings to
// `COPY[...]`, never to a string spelled out here (WO-249's idiom: assert
// the key reached, never the sentence).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY, copy } from "@/lib/presentation/copy";
import type { CanonicalDomain } from "@/lib/scan/domain";
import {
  REMOVED_RESPONSE_INIT,
  RemovalAddressLine,
  RemovedView,
} from "@/app/(public)/scan/[domain]/_address/removal";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const SRC = path.join(REPO_ROOT, "src");
const REMOVAL_MODULE = "src/app/(public)/scan/[domain]/_address/removal.tsx";
const COPY_PARTITION = "src/lib/presentation/copy/keys/report.ts";

const DOMAIN = "example.com" as CanonicalDomain;

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
    }
  })(SRC);
  return out;
}

const SOURCES = sourceFiles().map((file) => ({
  file,
  text: readFileSync(path.join(REPO_ROOT, file), "utf8"),
}));

/** A source file's code with its comments removed, so a *reference* to a
 *  copy key can be told apart from a *mention* of one in prose.
 *
 *  Why this exists: this suite used to assert that `removal.address` was
 *  referenced in exactly one file under `src/`. That form counted files,
 *  not addresses, so it broke the moment `src/lib/presentation/copy/keys/
 *  mail.ts` (#79) cited the key in a comment — a mention that resolves
 *  nothing and cannot make the address differ. REQ-002 c3 wants one
 *  address, not one file: one value in the registry, every consumer
 *  resolving it through `copy()`/`COPY`, and the two removal views sharing
 *  one call site. The three assertions below say exactly that, and still
 *  fail on the thing the file count was reaching for — a second value, a
 *  second declaration, or a consumer that reaches the address any other
 *  way. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every interactive element REQ-001 c18 forbids on a removed address, as
 *  tag names and as the one attribute that makes a plain element one. */
const INTERACTIVE_TAGS = ["button", "a", "form", "input", "select", "textarea", "label", "option"];

describe('REQ-002 c1 — "Given any report, when it renders, then it names in writing the address to which a request to remove the report about that domain is sent, readable by a visitor with no account, session, or payment."', () => {
  it("the line at the foot of a report names the address, resolved from `removal.address`", () => {
    const html = renderToStaticMarkup(React.createElement(RemovalAddressLine));
    expect(html).toContain(COPY["removal.address"]);
  });

  it("renders the `removal.line.on-report` sentence with its slot filled — no `{address}` placeholder survives", () => {
    const html = renderToStaticMarkup(React.createElement(RemovalAddressLine));
    expect(html).not.toContain("{address}");
    expect(html).toContain(COPY["removal.line.on-report"].split("{address}")[0]);
  });

  it("takes no props at all — nothing about the visitor can change the address", () => {
    expect(RemovalAddressLine.length).toBe(0);
  });

  it("neither view reads a cookie, a session or a header", () => {
    const text = readFileSync(path.join(REPO_ROOT, REMOVAL_MODULE), "utf8");
    for (const forbidden of ["cookies(", "headers(", "document.cookie", "currentSession", "hasActiveAccess"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("one address, from one key", () => {
  it("`removal.address` has exactly one value — one declaration, in one copy partition", () => {
    const declaring = SOURCES.filter((s) => /"removal\.address"\s*:/.test(code(s.text))).map((s) => s.file);
    expect(declaring).toEqual([COPY_PARTITION]);
  });

  it("every consumer reaches the address through the registry — no file names the key any other way", () => {
    for (const s of SOURCES) {
      if (s.file === COPY_PARTITION) continue;
      const text = code(s.text);
      const named = text.match(/removal\.address/g) ?? [];
      const resolved = text.match(/(?:copy\(\s*"removal\.address"\s*\)|COPY\[\s*"removal\.address"\s*\])/g) ?? [];
      expect(resolved.length, `${s.file} names \`removal.address\` without resolving it`).toBe(named.length);
    }
  });

  it("the removal views resolve it at a single call site", () => {
    const text = code(readFileSync(path.join(REPO_ROOT, REMOVAL_MODULE), "utf8"));
    expect(text.match(/removal\.address/g) ?? []).toHaveLength(1);
    expect(text).toContain('copy("removal.address")');
  });

  it("the address appears as a literal nowhere in `src/` outside the copy registry", () => {
    const address = COPY["removal.address"];
    const literals = SOURCES.filter((s) => s.file !== COPY_PARTITION && s.text.includes(address)).map(
      (s) => s.file
    );
    expect(literals).toEqual([]);
  });

  it("the removed line and the report's own line name the same address", () => {
    const onReport = renderToStaticMarkup(React.createElement(RemovalAddressLine));
    const removed = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));
    const address = COPY["removal.address"];
    expect(onReport).toContain(address);
    expect(removed).toContain(address);
  });
});

describe('REQ-002 c3 — "…in its place one written line says the report was removed at the domain owner\'s request and names the address criterion 1 names — until a request to that same address asks for that domain to be scannable again."', () => {
  it("renders exactly one written line, naming the domain and the address", () => {
    const html = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));
    expect(html.match(/<p>/g) ?? []).toHaveLength(1);
    expect(html).toContain(DOMAIN);
    expect(html).toContain(COPY["removal.address"]);
  });

  it("leaves no slot placeholder unfilled", () => {
    const html = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));
    expect(html).not.toContain("{domain}");
    expect(html).not.toContain("{address}");
  });

  it("shows no report content — no score, no band, no verdict, no card", () => {
    const html = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));
    // The whole body is one written line, so the claim is stated as an
    // equality: the rendered text *is* that line and there is nothing else in
    // it — no score, no band, no verdict, no card, and nothing outside the
    // registry either.
    //
    // It used to be stated as a sweep — every other registry sentence must not
    // appear as a substring of the markup — which was weaker (it could only
    // catch text the registry already held) and, from issue #18, wrong: BUILD
    // §4.7's Settings screen gave the registry its first single-word control
    // labels, and `settings.competitors.remove` ("remove") is a substring of
    // this very sentence's "removed" and of `removal.address` itself. The
    // sweep reported that collision as report content leaking onto a removed
    // address, which it is not.
    const rendered = html.replace(/<[^>]*>/g, "").trim();
    expect(rendered).toBe(
      copy("removal.line.removed", { domain: DOMAIN, address: COPY["removal.address"] })
    );
  });

  it("is a screen root — it declares its own three band arms (ADR-093)", () => {
    const html = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));
    expect(html).toContain("data-surface");
    expect(html).toContain('data-arm-compact="columns:1"');
  });
});

describe('REQ-001 c18 — "…no stored report is shown, no re-scan or retry control is offered, and no scan starts — criteria 12 to 17 offer no route back to a removed report."', () => {
  const html = renderToStaticMarkup(React.createElement(RemovedView, { domain: DOMAIN }));

  it.each(INTERACTIVE_TAGS)("renders no <%s>", (tag) => {
    expect(html).not.toMatch(new RegExp(`<${tag}[\\s>]`, "i"));
  });

  it("renders nothing clickable at all — no href, no onclick, no role=button", () => {
    expect(html).not.toContain("href");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain('role="button"');
  });

  it("starts nothing — the module posts to no scan endpoint and imports no admission function", () => {
    const text = readFileSync(path.join(REPO_ROOT, REMOVAL_MODULE), "utf8");
    for (const forbidden of ["/api/scan", "fetch(", "claimFreeScanSlot", "admitFreeScan"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("the status a removed address is served with — owner ruling 2026-09-05 (#28), ADR-002", () => {
  it("is 410 Gone", () => {
    expect(REMOVED_RESPONSE_INIT.status).toBe(410);
  });

  it("carries `noindex` — report pages are noindex forever (ADR-002)", () => {
    expect(REMOVED_RESPONSE_INIT.headers).toMatchObject({ "X-Robots-Tag": "noindex" });
  });

  it("is never cached, so a block takes effect on the very next read with no invalidation", () => {
    expect(REMOVED_RESPONSE_INIT.headers).toMatchObject({ "Cache-Control": "no-store" });
  });

  it("reads the pinned constant rather than spelling 410 out", () => {
    const text = readFileSync(path.join(REPO_ROOT, REMOVAL_MODULE), "utf8");
    expect(text).toContain("REPORT_REMOVED_STATUS");
    expect(text).not.toMatch(/status:\s*410/);
  });
});
