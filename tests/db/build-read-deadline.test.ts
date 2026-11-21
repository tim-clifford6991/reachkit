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
