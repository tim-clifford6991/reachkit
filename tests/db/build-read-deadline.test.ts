// A database that never answers during `next build` failed production deploys: the footer's read must give up in time.
import { expect, it, vi } from "vitest";
import { stubEnv } from "../jobs/env-fixture";

it("a build-time read of a hanging database returns nothing stored within the deadline, in one try", async () => {
  stubEnv(false);
  vi.stubEnv("SUPABASE_URL", "http://10.255.255.1:5432");
  vi.stubEnv("NEXT_PHASE", "phase-production-build");
  const hang = vi.fn((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
  );
  vi.stubGlobal("fetch", hang);
  const { BUILD_READ_DEADLINE_MS } = await import("@/lib/db/rest");
  const { readOwnArticles } = await import("@/app/(public)/_chrome/own-articles");
  const started = Date.now();
  await expect(readOwnArticles()).resolves.toBeNull();
  expect(Date.now() - started).toBeLessThan(BUILD_READ_DEADLINE_MS + 1000);
  expect(hang).toHaveBeenCalledTimes(1);
}, 15_000);

// A weekly pass's unbounded fan-out exhausted the database API's pool (PGRST003) and stalled people's reads.
it("a lane holds 20 admin reads to 4 in flight, nested lanes included, and reads outside a lane go at once", async () => {
  stubEnv(false);
  vi.stubEnv("NEXT_PHASE", "");
  let now = 0, peak = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { peak = Math.max(peak, ++now); await new Promise((go) => setTimeout(go, 5)); now -= 1; return new Response("[]", { headers: { "content-type": "application/json" } }); }));
  const { dbAdminRest, withDbLane } = await import("@/lib/db/rest");
  const reads = () => Promise.all(Array.from({ length: 20 }, () => dbAdminRest().from("sites").select("id"))).then((all) => expect(all.map((read) => read.error)).toEqual(Array(20).fill(null)));
  const peakOf = async (work: () => Promise<unknown>) => { peak = 0; await work(); return peak; };
  expect(await peakOf(() => withDbLane(4, reads))).toBe(4);
  expect(await peakOf(() => withDbLane(4, () => Promise.all([reads(), withDbLane(4, reads)])))).toBe(4);
  expect(await peakOf(reads)).toBe(20);
});
