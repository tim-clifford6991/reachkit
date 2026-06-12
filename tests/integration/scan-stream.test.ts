/**
 * Cycle 1 Task 15 acceptance gate: SSE stream route reads from scan_events
 *
 * Pre-inserts rows into scan_events (artifact, facts, done) before calling
 * the route's GET handler. The first poll finds all rows immediately, so the
 * stream closes after the done event without waiting 250ms * 120 iterations.
 *
 * LOCAL ONLY — not CI. Run with: pnpm test:int tests/integration/scan-stream.test.ts
 */
import { expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { NextRequest } from "next/server";

test("GET /api/scan/[id]/stream emits artifact+facts in order and stops at done", async () => {
  const db = serverDb();

  // 1. Insert prerequisite app + scan rows
  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: "https://stream.test/app", platform: "web" })
    .select("id")
    .single();
  expect(appErr).toBeNull();
  if (!appRow) throw new Error("No app row returned");

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow.id, status: "queued" })
    .select("id")
    .single();
  expect(scanErr).toBeNull();
  if (!scanRow) throw new Error("No scan row returned");

  const scanId = scanRow.id as string;

  // 2. Pre-insert scan_events so the first poll returns them immediately
  const { error: evtErr } = await db.from("scan_events").insert([
    { scan_id: scanId, type: "artifact", payload: { label: "reviews fetched", count: 42 } },
    { scan_id: scanId, type: "facts", payload: { competitors: ["App A", "App B"] } },
    { scan_id: scanId, type: "done", payload: { ok: true } },
  ]);
  expect(evtErr).toBeNull();

  // 3. Call the route handler directly
  const { GET } = await import("@/app/api/scan/[id]/stream/route");
  const req = new NextRequest(`http://localhost/api/scan/${scanId}/stream`);
  const res = await GET(req, { params: Promise.resolve({ id: scanId }) });

  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("text/event-stream");

  // 4. Read the full body, decoding SSE data: lines
  const body = res.body;
  if (!body) throw new Error("Response has no body");

  const events: Array<{ type: string; payload: unknown }> = [];
  const decoder = new TextDecoder();
  let buffer = "";

  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Parse complete SSE lines from the buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const json = trimmed.slice("data: ".length);
        events.push(JSON.parse(json) as { type: string; payload: unknown });
      }
    }
  }
  // Flush any remaining buffered line
  const trimmed = buffer.trim();
  if (trimmed.startsWith("data: ")) {
    const json = trimmed.slice("data: ".length);
    events.push(JSON.parse(json) as { type: string; payload: unknown });
  }

  // 5. Assert: artifact, facts, then done — in order — and no extras after done
  expect(events.length).toBeGreaterThanOrEqual(3);

  const artifactEvt = events[0];
  if (!artifactEvt) throw new Error("No artifact event");
  expect(artifactEvt.type).toBe("artifact");
  expect(artifactEvt.payload).toMatchObject({ label: "reviews fetched", count: 42 });

  const factsEvt = events[1];
  if (!factsEvt) throw new Error("No facts event");
  expect(factsEvt.type).toBe("facts");
  expect(factsEvt.payload).toMatchObject({ competitors: ["App A", "App B"] });

  const doneEvt = events[2];
  if (!doneEvt) throw new Error("No done event");
  expect(doneEvt.type).toBe("done");

  // Stream must close after done — no further events
  expect(events.length).toBe(3);
}, 30_000);
