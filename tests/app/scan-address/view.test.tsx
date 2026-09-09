// tests/app/scan-address/view.test.tsx
//
// BUILD §4.1's "States:" clause (issue #13). The total switch: every arm of
// `AddressState` renders something, and nothing renders a blank page, a
// 404 or an unhandled error.
//
// Same rendering convention as `report-view.test.tsx` — `react-dom/server`,
// `copy()` mocked to its key. The `starting` and `scanning` arms mount a
// Client Component that posts and subscribes on first frame; under
// `renderToStaticMarkup` no effect runs, which is exactly the property
// REQ-001 c9 asks for ("never during server render") and is asserted here
// as such rather than worked around.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

// `useRouter` throws outside a mounted App Router. The scanning arms use it
// for one thing — asking the server to re-resolve the address when the
// stream ends (REQ-003 c3) — and that is an effect, which
// `renderToStaticMarkup` never runs. Mocking the hook lets the server-side
// tree render so the *markup* can be asserted; the refresh call itself is
// asserted by source, the convention `api-scan.test.ts` already uses for
// wiring a static render cannot execute.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AddressView } from "@/app/(public)/scan/[domain]/_address/view";
import type { AddressState } from "@/app/(public)/scan/[domain]/_address/state";
import { fixtureStateFor } from "@/app/(public)/scan/[domain]/_fixture/states";
import type { CanonicalDomain } from "@/lib/scan/domain";

// The six `StageName` handles, transcribed as plain literals. Importing
// them as values would pull `src/lib/scan/stages.ts` — and through it
// `dbAdmin` and the parsed server environment — into this suite, which is
// exactly the edge `_address/progress.tsx` avoids for the browser bundle.
// The compile-time guarantee that these are the six the engine declares is
// that file's own `satisfies Record<StageName, CopyKey>`.
const STAGES = [
  "reading_your_site",
  "reading_access_rules",
  "reading_your_market",
  "checking_your_presence",
  "asking_the_twelve",
  "scoring",
] as const;

const DOMAIN = "example.com" as CanonicalDomain;

function render(state: AddressState): string {
  return renderToStaticMarkup(
    React.createElement(AddressView, { state })
  );
}

/** One instance of every arm the union declares. The list is the point of
 *  the suite: an eighth arm added to `state.ts` fails the build in
 *  `view.tsx`'s `never` default, and fails here for want of a row. */
const ARMS: ReadonlyArray<readonly [AddressState["kind"], AddressState]> = [
  ["malformed", { kind: "malformed", problem: "ip_literal", value: "203.0.113.5" }],
  ["removed", { kind: "removed", domain: DOMAIN }],
  ["starting", { kind: "starting", domain: DOMAIN }],
  ["scanning", { kind: "scanning", domain: DOMAIN, scanId: "scan-1" }],
  [
    "refused",
    { kind: "refused", domain: DOMAIN, refusal: { reason: "scan-running", retryAfterSeconds: 90 } },
  ],
  ["cooldown", { kind: "cooldown", domain: DOMAIN }],
  ["report", fixtureReport()],
];

describe("REQ-001 c5 — every arm answers; never a blank page, a 404 or an error", () => {
  it.each(ARMS)("%s renders a non-empty tree", (_kind, state) => {
    const html = render(state);
    expect(html.length).toBeGreaterThan(0);
    expect(html.replace(/<[^>]*>/g, "").trim().length).toBeGreaterThan(0);
  });

  it.each(ARMS)("%s renders exactly one [data-surface] screen root", (_kind, state) => {
    // ADR-093 decision 6 / BP-018: every screen root is a `Surface`, and
    // `tests/ui/layout/layout.test.ts` asserts exactly one per document.
    // Seven arms are seven screens, so each declares its own — including
    // `removed`, which brings one from `_address/removal.tsx` (#28) and is
    // therefore rendered bare rather than wrapped a second time.
    expect(render(state).split("data-surface").length - 1).toBe(1);
  });

  it("the switch covers every arm the union declares — no row is missing here", () => {
    const declared = readFileSync(
      new URL("../../../src/app/(public)/scan/[domain]/_address/state.ts", import.meta.url),
      "utf8"
    );
    const kinds = [...declared.matchAll(/kind: "([a-z_]+)"/g)].map((m) => m[1]);
    const stateKinds = new Set(
      kinds.filter((k) =>
        ["malformed", "removed", "starting", "scanning", "refused", "cooldown", "report"].includes(k!)
      )
    );
    expect([...stateKinds].sort()).toEqual(ARMS.map(([k]) => k).sort());
  });
});

describe("REQ-001 c4 — malformed offers the landing field and one written line", () => {
  const html = render(ARMS[0]![1]);

  it("renders the landing page's own line for the problem, not a second copy of it", () => {
    expect(html).toContain("landing.problem.ip-literal");
  });

  it("offers the landing field, with the submitted value intact", () => {
    expect(html).toContain("landing.field.label");
    expect(html).toContain("203.0.113.5");
  });

  it("starts no scan — the only form here posts to the landing's own endpoint", () => {
    expect(html).toContain('action="/api/scan"');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("REQ-003 c1 — the scanning arms show named stages, never a bare spinner", () => {
  it.each([ARMS[2]!, ARMS[3]!])("%s names every stage in STAGES", (_kind, state) => {
    const html = render(state);
    for (const stage of STAGES) expect(html).toContain(`stage.${stage}`);
  });

  it("shows no percentage, countdown or indeterminate bar", () => {
    const html = render(ARMS[3]![1]);
    expect(html).not.toContain("<progress");
    expect(html).not.toContain("%");
  });

  it("posts nothing during server render (REQ-001 c9)", () => {
    render(ARMS[2]![1]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("REQ-003 c12 / REQ-001 c16 — refused offers no control; cooldown offers exactly one", () => {
  it("refused writes the refusal and offers nothing to press", () => {
    const html = render(ARMS[4]![1]);
    expect(html).toContain("notice.refused.scan-running");
    expect(html).not.toContain("<button");
  });

  it("cooldown writes one line and offers one retry, and starts nothing by itself", () => {
    const html = render(ARMS[5]![1]);
    expect(html).toContain("notice.measurement-failed");
    expect(html).toContain("control.retry");
    expect(html.split("<button").length - 1).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("REQ-002 c3 / REQ-001 c18 — removed has no route back", () => {
  const html = render(ARMS[1]![1]);

  it("names the address in one line", () => {
    expect(html).toContain("removal.line.removed(example.com|removal.address)");
  });

  it("carries no control, form, link or field", () => {
    for (const tag of ["<button", "<form", "<input", "<a "]) expect(html).not.toContain(tag);
  });
});

/** The fixture answers for reserved names only (#104), so every case below
 *  asks about one and refuses to proceed if the gate turned it away. */
function fixtureFor(domain: string): AddressState {
  const state = fixtureStateFor(domain as CanonicalDomain);
  if (state === null) throw new Error(`no fixture arm for ${domain}`);
  return state;
}

function fixtureReport(): AddressState {
  return fixtureFor("example.com");
}

describe("the fixture resolution, on reserved names only (#104)", () => {
  it("a reserved subdomain with no arm of its own resolves to the complete report, with no notice and no control", () => {
    const state = fixtureFor("acme.example.com");
    expect(state.kind).toBe("report");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toBeNull();
    expect(state.control).toEqual({ kind: "none" });
  });

  it("the resolved report carries the domain that was asked for", () => {
    const state = fixtureFor("acme.example.com");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.report.verdict.domain).toBe("acme.example.com");
  });

  it("every domain that is not a reserved name resolves to null — a real address can never be served invented figures", () => {
    for (const domain of ["acme.example", "reachkit.app", "example.net", "example.org", "notexample.com"]) {
      expect(fixtureStateFor(domain as CanonicalDomain)).toBeNull();
    }
  });

  it("a name that merely ends with the reserved one is not a reserved name", () => {
    expect(fixtureStateFor("evilexample.com" as CanonicalDomain)).toBeNull();
    expect(fixtureStateFor("example.com" as CanonicalDomain)).not.toBeNull();
    expect(fixtureStateFor("degraded.example.com" as CanonicalDomain)).not.toBeNull();
  });

  it("each fixture domain reaches its own arm", () => {
    const expected: ReadonlyArray<readonly [string, AddressState["kind"]]> = [
      ["degraded.example.com", "report"],
      ["cold-start.example.com", "report"],
      ["starting.example.com", "starting"],
      ["scanning.example.com", "scanning"],
      ["refused.example.com", "refused"],
      ["cooldown.example.com", "cooldown"],
      ["removed.example.com", "removed"],
    ];
    for (const [domain, kind] of expected) {
      expect(fixtureFor(domain).kind).toBe(kind);
    }
  });

  it("the degraded fixture is the state §4.1 names: score nulled, sections absent, notice and control present", () => {
    const state = fixtureFor("degraded.example.com");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.report.verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(state.report.aiAnswers).toBeNull();
    expect(state.report.presence).toBeNull();
    expect(state.notice).toEqual({ kind: "incomplete", unmeasured: ["foundations", "presence"] });
    expect(state.control).toEqual({ kind: "rescan", because: "incomplete" });
  });

  it("a measured zero in the degraded fixture stays a zero — it is not swept into the dash", () => {
    const state = fixtureFor("degraded.example.com");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.report.supply.missingPages.kind).toBe("zero");
  });
});
