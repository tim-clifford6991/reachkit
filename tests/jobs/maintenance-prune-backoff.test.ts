// A prune whose database call fails records one ops event and stops; the next tick, with that row present, asks nothing.
import { afterEach, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("a timed-out listing is one ops_events insert and no other call, and the next tick backs off without an rpc", async () => {
  stubEnv(false);
  for (const [key, to] of [["VERCEL_ENV", "production"], ["RK_FACTS_VERSION", "f1"], ["RK_TEXT_VERSION", "t1"]] as const) vi.stubEnv(key, to);
  let held = false;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const call = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/rest\/v1\//, "")}`;
    calls.push(call);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (call === "GET ops_events") return json(held ? [{ id: 1 }] : []);
    if (call === "POST ops_events") return (held = true), new Response(null, { status: 201 });
    return json({ code: "57014", message: "canceling statement due to statement timeout" }, 500);
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { prunePageHtml } = await import("@/lib/costs/ledger");
  await prunePageHtml();
  expect(calls).toEqual(["GET ops_events", "POST rpc/fetches_html_due", "POST ops_events"]);
  calls.length = 0;
  await prunePageHtml();
  expect(calls).toEqual(["GET ops_events"]);
  expect(log.mock.calls.map(([line]) => String(line))).toContain(JSON.stringify({ event: "page_html_prune", outcome: "backoff" }));
});
