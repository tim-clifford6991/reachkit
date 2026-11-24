// A weekly pass's unbounded fan-out exhausted the database API's pool (PGRST003) and stalled people's reads.
import { expect, it, vi } from "vitest";
import { stubEnv } from "../jobs/env-fixture";

it("a lane holds 20 admin reads to 4 in flight, nested lanes included, and reads outside a lane go at once", async () => {
  stubEnv(false);
  let now = 0, peak = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { peak = Math.max(peak, ++now); await new Promise((go) => setTimeout(go, 5)); now -= 1; return new Response("[]", { headers: { "content-type": "application/json" } }); }));
  const { dbAdminRest, withDbLane } = await import("@/lib/db/rest");
  const reads = () => Promise.all(Array.from({ length: 20 }, () => dbAdminRest().from("sites").select("id"))).then((all) => expect(all.map((read) => read.error)).toEqual(Array(20).fill(null)));
  const peakOf = async (work: () => Promise<unknown>) => { peak = 0; await work(); return peak; };
  expect(await peakOf(() => withDbLane(4, reads))).toBe(4);
  expect(await peakOf(() => withDbLane(4, () => Promise.all([reads(), withDbLane(4, reads)])))).toBe(4);
  expect(await peakOf(reads)).toBe(20);
});
