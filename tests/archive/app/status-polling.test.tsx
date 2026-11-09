/** @vitest-environment jsdom */
// tests/app/status-polling.test.tsx — issue 2104: a waiting screen asks a
// small status route and re-renders itself only when that answer changes,
// so a tab left open reads one column, not the whole report or draft.
import "../generate/env";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
let session: { userId: string; siteId: string | null } | null = null;
vi.mock("@/lib/account/identity", () => ({ currentSession: async () => session }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

import { TIMING } from "@/lib/config/constants";
import { GET as scanReads } from "@/app/api/scan/[scanId]/reads/route";
import { GET as draftState } from "@/app/api/draft-state/[id]/route";
import { StillReading } from "@/app/(public)/scan/[domain]/_address/still-reading";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";

const NOW = new Date("2026-11-03T10:00:00Z");

/** `finishing` is what PostgREST answers for `finishing:report->finishingReads`. */
function seedScan(over: Record<string, unknown> = {}, finishingReads: unknown = { searches: 3, since: NOW.toISOString() }): void {
  db.reset();
  db.seed("scans", [
    { id: "scan-1", domain: "acme.test", is_current: true, report: { scanId: "scan-1", finishingReads }, finishing: finishingReads, ...over },
  ]);
}

async function askScan(scanId = "scan-1"): Promise<{ status: number; body: unknown; cache: string | null }> {
  const response = await scanReads(new Request(`https://dev.reachkit.app/api/scan/${scanId}/reads`), {
    params: Promise.resolve({ scanId }),
  });
  return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
}

async function askDraft(id = "d1"): Promise<{ status: number; body: unknown }> {
  const response = await draftState(new Request(`https://dev.reachkit.app/api/draft-state/${id}`), {
    params: Promise.resolve({ id }),
  });
  return { status: response.status, body: await response.json() };
}

/** Every column a recorded read named. A bare `report`, `body_md` or `meta`
 *  would be the blob the routes exist not to read. */
function selected(table: string): string[] {
  return db.queries.filter((q) => q.table === table && q.verb === "select").flatMap((q) => (q.columns ?? "").split(",").map((c) => c.trim()));
}

describe("GET /api/scan/{scanId}/reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("answers true while the report says it is reading, false once the job has written it, and never caches", async () => {
    seedScan();
    expect(await askScan()).toEqual({ status: 200, body: { finishing: true }, cache: "no-store" });
    seedScan({}, null);
    expect((await askScan()).body).toEqual({ finishing: false });
  });

  it("reads one json path of the report, never the blob", async () => {
    seedScan();
    await askScan();
    const columns = selected("scans");
    expect(columns).toContain("finishing:report->finishingReads");
    expect(columns).not.toContain("report");
  });

  it("a lapsed marker is false, as the report's own line is", async () => {
    seedScan({}, { searches: 3, since: new Date(NOW.getTime() - TIMING.finishReadsNoticeS * 1000).toISOString() });
    expect((await askScan()).body).toEqual({ finishing: false });
  });

  it("an unknown, superseded or removed scan answers exactly as a finished one", async () => {
    seedScan();
    expect(await askScan("scan-unknown")).toEqual({ status: 200, body: { finishing: false }, cache: "no-store" });
    seedScan({ is_current: false });
    expect(await askScan()).toEqual({ status: 200, body: { finishing: false }, cache: "no-store" });
    seedScan();
    db.seed("domain_blocks", [{ domain: "acme.test" }]);
    expect(await askScan()).toEqual({ status: 200, body: { finishing: false }, cache: "no-store" });
  });
});

describe("GET /api/draft-state/{id}", () => {
  beforeEach(() => {
    db.reset();
    db.seed("drafts", [{ id: "d1", site_id: "s1", state: "generating", body_md: "# long body", meta: { big: true } }]);
    session = { userId: "u1", siteId: "s1" };
  });

  it("answers the owned draft's state and reads only that column", async () => {
    expect(await askDraft()).toEqual({ status: 200, body: { state: "generating" } });
    expect(selected("drafts")).toEqual(["state"]);
  });

  it("another site's draft is answered as one that does not exist, and no session is 401", async () => {
    session = { userId: "u2", siteId: "s2" };
    const foreign = await askDraft();
    const missing = await askDraft("d-missing");
    expect(foreign).toEqual({ status: 404, body: { error: "not_found" } });
    expect(missing).toEqual(foreign);
    session = null;
    expect((await askDraft()).status).toBe(401);
  });
});

/** The status route the client asks, answered by the test. */
function answering(bodies: () => unknown): string[] {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify(bodies()), { status: 200, headers: { "content-type": "application/json" } });
  });
  return asked;
}

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the waiting screens re-render only when the status moves", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    refresh.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("the still-reading line asks its scan's route every 5 s and refreshes once the answer turns false", async () => {
    let finishing = true;
    const asked = answering(() => ({ finishing }));
    act(() => root.render(<StillReading line="Still reading 3 searches" untilMs={Date.now() + 60_000} scanId="scan-1" />));
    await tick(15_000);
    expect(asked).toEqual(Array(3).fill("/api/scan/scan-1/reads"));
    expect(refresh).not.toHaveBeenCalled();
    finishing = false;
    await tick(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("the still-reading line stops asking once its window is over", async () => {
    const asked = answering(() => ({ finishing: true }));
    act(() => root.render(<StillReading line="Still reading 3 searches" untilMs={Date.now() + 12_000} scanId="scan-1" />));
    await tick(60_000);
    expect(asked).toHaveLength(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a page being written again asks its draft's state at the heartbeat and refreshes once it has moved", async () => {
    let state = "generating";
    const asked = answering(() => ({ state }));
    const view = assembleDraft({ ...FIXTURE_DRAFTS[FIXTURE_DRAFT_ID]!, state: "generating" });
    act(() => root.render(<DraftScreen view={view} generatedLabel="Written by ReachKit" />));
    expect(container.querySelector('[data-testid="draft-rewriting"]')).not.toBeNull();
    const heartbeat = TIMING.progressHeartbeatS * 1000;
    await tick(heartbeat * 3);
    expect(asked).toEqual(Array(3).fill(`/api/draft-state/${FIXTURE_DRAFT_ID}`));
    expect(refresh).not.toHaveBeenCalled();
    state = "in_review";
    await tick(heartbeat);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
