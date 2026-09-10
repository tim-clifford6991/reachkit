// tests/app/scan-address/api-scan.test.ts
//
// WO-062 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-001.md` and `requirements/REQ-003.md`, and from BP-022's own
// `## Decisions`) — the response, idempotence, no-JS and no-session
// suites for `POST /api/scan`.
//
// `src/app/api/scan/route.ts` is a thin adapter (rule 1, `structure.md`):
// it calls WO-051's `parseDomain` (exercised directly — pure, no mock
// needed) and WO-057/WO-058's `networkKeyOf`/`claimFreeScanSlot` (mocked
// here, exactly as `tests/scan/free/admission-claim.test.ts` mocks
// `@/lib/db` one layer down — that file's own suites already discharge
// the admission order and the transaction; this file exercises only what
// this route adds: content negotiation, the location it returns, and the
// union it builds around a claim/refusal). No `@/lib/db` mock and no env
// fixture is needed here for the same reason: mocking `@/lib/scan/
// admission` replaces the module wholesale, so its own `env`/`dbAdmin`
// imports never load.
//
// `structure.md` rule 4: tests live beside the module they exercise —
// `tests/app/scan-address/**` is BP-022's own file-plan entry for this WO.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scan/admission", () => ({
  networkKeyOf: vi.fn(),
  claimFreeScanSlot: vi.fn(),
}));

// Issue #438 — the keep-alive seam. The route hands the pass to `after()`
// rather than dropping a promise on the floor, so what this file can
// observe is the *registration*: the tasks the route handed over, and what
// running one does. Standing in for `next/server` is also what makes the
// route callable at all outside a request scope — the real `after` throws
// there, by design.
const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as (() => Promise<void>)[] }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(task);
  },
}));
// The pipeline itself, replaced wholesale so no engine — and no `@/lib/db`
// — is loaded by this suite, exactly as the admission mock above does one
// layer down.
vi.mock("@/lib/scan/run", () => ({ runScan: vi.fn() }));

import { networkKeyOf, claimFreeScanSlot } from "@/lib/scan/admission";
import { runScan } from "@/lib/scan/run";
import type { Admission, NetworkKey } from "@/lib/scan/admission";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { POST, maxDuration } from "@/app/api/scan/route";

const ROUTE_PATH = path.resolve(import.meta.dirname, "../../../src/app/api/scan/route.ts");
const ROUTE_SOURCE = readFileSync(ROUTE_PATH, "utf8");

const NETWORK = "network-key-fixture" as NetworkKey;

function postJson(value: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(typeof value === "string" ? { value } : value),
  });
}

function postRawJson(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function postForm(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  const form = new URLSearchParams(fields);
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: form.toString(),
  });
}

beforeEach(() => {
  afterTasks.length = 0;
  vi.mocked(networkKeyOf).mockReturnValue(NETWORK);
  vi.mocked(claimFreeScanSlot).mockResolvedValue({ claimed: true, scanId: "claimed-scan-id" });
  vi.mocked(runScan).mockResolvedValue({ scanId: "claimed-scan-id", status: "done" });
});

afterEach(() => {
  vi.mocked(networkKeyOf).mockReset();
  vi.mocked(claimFreeScanSlot).mockReset();
  vi.mocked(runScan).mockReset();
  vi.mocked(runScan).mockResolvedValue({ scanId: "claimed-scan-id", status: "done" });
});

// ── REQ-001 c2 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c2 — "Given a visitor who enters a domain in any of its written forms — with or without a scheme, with or without `www`, with a trailing path, in any letter case — when they submit, then they arrive at the single public report address for that domain; no two of those forms produce different addresses or different stored reports."',
  () => {
    it.each([
      "example.com",
      "http://example.com",
      "https://example.com",
      "www.example.com",
      "https://www.EXAMPLE.com/some/path",
      "EXAMPLE.COM.",
    ])("api/scan · every written form posts to one location — %s", async (form) => {
      const res = await POST(postJson(form));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: true; location: string; scanId?: string };
      expect(body.ok).toBe(true);
      expect(body.location).toBe("/scan/example.com");
    });
  }
);

// ── REQ-001 c3 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c3 — "Given a visitor who submits a value that is not a well-formed public domain name — an empty value, an IP literal, or a hostname with no public suffix — when they submit, then one written line names what is wrong with the value and the visitor stays on the landing page with their input intact. A well-formed domain is accepted here whether or not it resolves; a domain that cannot be reached is a failed scan (REQ-003), not a rejected input."',
  () => {
    it.each([
      ["", "empty"],
      ["203.0.113.5", "ip_literal"],
      ["localhost", "no_public_suffix"],
    ] as const)("api/scan · a malformed value is 422 with its handle — %s -> %s", async (value, problem) => {
      const res = await POST(postJson(value));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toEqual({ ok: false, problem });
    });

    it("api/scan · without JavaScript the value survives", async () => {
      const res = await POST(postForm({ value: "203.0.113.5" }));
      expect(res.status).toBe(303);
      const location = new URL(res.headers.get("location") ?? "", "http://localhost");
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("problem")).toBe("ip_literal");
      expect(location.searchParams.get("value")).toBe("203.0.113.5");
    });

    it("api/scan · a domain that does not resolve is accepted, and this handler makes no DNS call", async () => {
      const res = await POST(postJson("this-domain-does-not-resolve-anywhere.example.com"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: true; location: string };
      expect(body.location).toBe("/scan/this-domain-does-not-resolve-anywhere.example.com");
      // "asserted by spy that no DNS call was made in this handler" — a
      // runtime spy on `node:dns` cannot be installed under Vitest's ESM
      // module namespace (`Cannot redefine property` — a harness
      // limitation, not a behaviour this file can observe differently),
      // so this is the reachable equivalent: this route imports no DNS
      // module at all, so no call into one is reachable from it, and the
      // one module it delegates parsing to (`parseDomain`, WO-051)
      // carries the same guarantee by its own header ("No DNS, no fetch,
      // no clock").
      expect(ROUTE_SOURCE).not.toMatch(/node:dns/);
      const domainSource = readFileSync(
        path.resolve(import.meta.dirname, "../../../src/lib/scan/domain.ts"),
        "utf8"
      );
      expect(domainSource).not.toMatch(/node:dns/);
    });
  }
);

// ── REQ-001 c9 ─────────────────────────────────────────────────────────

describe(
  'REQ-001 c9 — "Given a well-formed domain that has no stored report, is not in a failure cooldown, and whose report was not removed at its owner\'s request, when its report address is first reached … then a scan for that domain is already underway with no further action from the visitor …"',
  () => {
    it("api/scan · a clean domain is underway on return", async () => {
      vi.mocked(claimFreeScanSlot).mockResolvedValue({ claimed: true, scanId: "running-scan-id" });
      const res = await POST(postJson("example.com"));
      const body = (await res.json()) as { ok: true; location: string; scanId?: string };
      expect(body.ok).toBe(true);
      expect(body.scanId).toBe("running-scan-id");
      expect(vi.mocked(claimFreeScanSlot)).toHaveBeenCalledWith({
        domain: "example.com" as CanonicalDomain,
        network: NETWORK,
        fromIncompleteRescan: false,
      });
      // "before the response is sent" — this route's own claim is a single
      // `await claimFreeScanSlot(...)` ahead of every response it builds
      // (source assertion, since the mock resolves synchronously and
      // cannot itself discriminate call order).
      expect(ROUTE_SOURCE).toMatch(/await\s+claimFreeScanSlot\(/);
    });
  }
);

// ── REQ-001 c10 ────────────────────────────────────────────────────────

describe(
  'REQ-001 c10 — "Given a visitor for whom a scan started under criterion 9, when they wait through it and read the report, then nothing is asked of them at any point between the domain they gave and the report they read — no account, sign-in, email address, or payment, and no further field. …"',
  () => {
    it("api/scan · nothing is asked, nothing is set", async () => {
      const requests = [
        postJson("example.com"),
        postJson(""),
        postForm({ value: "example.com" }),
        postForm({ value: "" }),
      ];
      for (const request of requests) {
        const res = await POST(request);
        expect(res.headers.get("set-cookie")).toBeNull();
      }
    });

    it("api/scan · route.ts imports no session, auth or account module", () => {
      expect(ROUTE_SOURCE).not.toMatch(/from\s+["'][^"']*\b(session|auth|account)\b[^"']*["']/i);
    });
  }
);

// ── REQ-003 c7 ─────────────────────────────────────────────────────────

describe(
  'REQ-003 c7 — "Given a scan is already running from the visitor\'s network, when another scan would start for them, then no second scan starts; if the running scan is of the domain they asked for they are returned to it, and if it is not they are refused in writing, told how long until they may scan, and are never shown a scan or a report of a domain they did not ask for."',
  () => {
    it("api/scan · a double post joins the one running scan", async () => {
      vi.mocked(claimFreeScanSlot).mockResolvedValueOnce({ claimed: true, scanId: "first-scan-id" });
      const first = await POST(postJson("example.com"));
      const firstBody = (await first.json()) as { ok: true; scanId?: string };
      expect(firstBody.scanId).toBe("first-scan-id");

      const refusal: Admission = { refuse: "in_flight", sameDomain: true, runningScanId: "first-scan-id" };
      vi.mocked(claimFreeScanSlot).mockResolvedValueOnce({ claimed: false, refusal });
      const second = await POST(postJson("example.com"));
      const secondBody = (await second.json()) as { ok: true; scanId?: string };
      expect(secondBody.scanId).toBe("first-scan-id");
    });

    it("api/scan · a different domain is not returned", async () => {
      const refusal: Admission = { refuse: "in_flight", sameDomain: false };
      vi.mocked(claimFreeScanSlot).mockResolvedValue({ claimed: false, refusal });
      const res = await POST(postJson("other.example.com"));
      const body = (await res.json()) as { ok: true; location: string; scanId?: string };
      expect(body.location).toBe("/scan/other.example.com");
      expect(body.scanId).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("first-scan-id");
    });
  }
);

// ── REQ-003 c12 ────────────────────────────────────────────────────────

describe(
  'REQ-003 c12 — "Given a visitor refused under criterion 6 or 7 at the report address of a domain with no stored report, when the address loads, then it shows that refusal in writing and starts no scan — never a blank page, a 404, or an error (REQ-001 criterion 5) …"',
  () => {
    const REFUSALS: Record<string, Admission> = {
      hourly: { refuse: "hourly", retryAfterSeconds: 120 },
      daily: { refuse: "daily", retryAfterSeconds: 3600 },
      in_flight: { refuse: "in_flight", sameDomain: false },
      switched_off: { refuse: "switched_off" },
      cooldown: { refuse: "cooldown", retryAfterSeconds: 86_000 },
      removed: { refuse: "removed" },
    };

    it.each(Object.keys(REFUSALS))(
      "api/scan · a refusal still yields a location, never an error status — %s",
      async (reason) => {
        vi.mocked(claimFreeScanSlot).mockResolvedValue({ claimed: false, refusal: REFUSALS[reason]! });

        const jsonRes = await POST(postJson("example.com"));
        expect(jsonRes.status).toBeGreaterThanOrEqual(200);
        expect(jsonRes.status).toBeLessThan(300);
        const body = (await jsonRes.json()) as { ok: true; location: string };
        expect(body.ok).toBe(true);
        expect(body.location).toBe("/scan/example.com");

        const formRes = await POST(postForm({ value: "example.com" }));
        expect(formRes.status).toBe(303);
        const location = new URL(formRes.headers.get("location") ?? "", "http://localhost");
        expect(location.pathname).toBe("/scan/example.com");
      }
    );
  }
);

// ── BP-022 decision 3 ──────────────────────────────────────────────────

describe(
  'BP-022 decision 3 — "the API is a canonicaliser and a starter … the report is only ever served by `GET /scan/{domain}`"',
  () => {
    it("api/scan · this route never returns a report", async () => {
      const requests = [postJson("example.com"), postJson(""), postForm({ value: "example.com" })];
      for (const request of requests) {
        const res = await POST(request);
        const text = await res.clone().text();
        expect(text.toLowerCase()).not.toMatch(/\breport\b/);
        expect(text.toLowerCase()).not.toMatch(/\bscore\b/);
        expect(text.toLowerCase()).not.toMatch(/\bband\b/);
      }
    });

    it("api/scan · route.ts imports no readCurrentReport, resolveAddress or component", () => {
      expect(ROUTE_SOURCE).not.toMatch(/readCurrentReport/);
      expect(ROUTE_SOURCE).not.toMatch(/resolveAddress/);
      expect(ROUTE_SOURCE).not.toMatch(/from\s+["']@\/ui\//);
    });
  }
);

// ── Step 2 — malformed request bodies ─────────────────────────────────

describe("WO-062 `## Steps` step 2 — a malformed body is a 400 with no problem handle", () => {
  it("api/scan · a non-JSON body on a JSON content-type is 400", async () => {
    const res = await POST(postRawJson("not json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).not.toHaveProperty("problem");
  });

  it("api/scan · a JSON body with no string value field is 400", async () => {
    const res = await POST(postJson({ notValue: "example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).not.toHaveProperty("problem");
  });

  it("api/scan · a body with neither a JSON nor a form content-type is 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/scan", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "example.com",
      })
    );
    expect(res.status).toBe(400);
  });
});

// ── Out of scope guard — this file exports POST only ──────────────────

describe("Out of scope — this file exports POST only", () => {
  it("api/scan · route.ts declares no GET handler", () => {
    expect(ROUTE_SOURCE).not.toMatch(/export\s+(async\s+)?function\s+GET\b/);
    expect(ROUTE_SOURCE).not.toMatch(/export\s+const\s+GET\b/);
  });
});

// ── Issue #438 — the pass outlives the response ────────────────────────

describe("issue #438 — the pipeline is registered with the keep-alive seam, never left as a dangling promise", () => {
  it("api/scan · a claim hands the pass to after(), and running that task runs the free pass", async () => {
    const res = await POST(postJson("example.com"));
    expect(res.status).toBe(200);

    // The registration is the assertion: the route did not merely start a
    // promise and return — it handed the work to the seam that keeps the
    // invocation alive past the response.
    expect(afterTasks).toHaveLength(1);
    expect(runScan).not.toHaveBeenCalled();

    await afterTasks[0]!();
    expect(runScan).toHaveBeenCalledWith({ domain: "example.com", tier: "free" });
  });

  it("api/scan · a refusal registers no task at all — nothing is kept alive for a pass that never started", async () => {
    vi.mocked(claimFreeScanSlot).mockResolvedValue({
      claimed: false,
      refusal: { refuse: "in_flight", sameDomain: true, runningScanId: "running-scan-id" },
    });
    const res = await POST(postJson("example.com"));
    expect(res.status).toBe(200);
    expect(afterTasks).toHaveLength(0);
  });

  it("api/scan · a pass that throws is logged and never reaches the response, which has already gone", async () => {
    const logged: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
    vi.mocked(runScan).mockRejectedValue(new Error("the engine fell over"));

    await POST(postJson("example.com"));
    await expect(afterTasks[0]!()).resolves.toBeUndefined();
    expect(logged.map((line) => JSON.parse(line).event)).toContain("scan_start_failed");
    log.mockRestore();
  });

  it("api/scan · route.ts registers through `after`, and drops no promise on the floor", () => {
    expect(ROUTE_SOURCE).toMatch(/import\s+\{\s*after\s*\}\s+from\s+["']next\/server["']/);
    expect(ROUTE_SOURCE).toMatch(/after\(/);
    // The shape the live check found doing nothing on the deployment: a
    // promise started and abandoned, which a frozen invocation never runs.
    expect(ROUTE_SOURCE).not.toMatch(/void\s+import\(/);
  });

  it("api/scan · the route declares the platform's own ceiling, once, as a literal Next can read at build time", () => {
    expect(maxDuration).toBe(60);
    // Route segment config is extracted from the source, so an imported
    // binding would be invisible to the build — and a number Next cannot
    // see is a ceiling the platform never applies.
    expect(ROUTE_SOURCE).toMatch(/export const maxDuration = \d+;/);
    expect(ROUTE_SOURCE.match(/export const maxDuration/g)).toHaveLength(1);
  });
});
