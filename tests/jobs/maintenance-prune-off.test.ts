// The maintenance tick reaches neither page-html prune function nor a page payload, even in production.
import { afterEach, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("a production maintenance tick calls no prune function and reads no fetches payload", async () => {
  stubEnv(false);
  for (const [key, to] of [["VERCEL_ENV", "production"], ["RK_FACTS_VERSION", "f1"], ["RK_TEXT_VERSION", "t1"]] as const) vi.stubEnv(key, to);
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    urls.push(decodeURIComponent(String(input instanceof Request ? input.url : input)));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { accountMaintenance } = await import("@/jobs/account-maintenance");
  await accountMaintenance.run({ data: {}, now: new Date() }).catch(() => undefined);
  expect(urls.filter((u) => /prune_page_html|page_reads_underived|\/fetches\?.*payload/.test(u))).toEqual([]);
  expect(log.mock.calls.map(([line]) => String(line))).toContain(JSON.stringify({ event: "page_html_prune", outcome: "off" }));
});
