// Next's own `IncrementalCache` over an in-memory store, so a suite runs
// `unstable_cache` for real. Import it before anything that loads Next.
import { AsyncLocalStorage } from "node:async_hooks";

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;

/** What the cache holds, by key; a suite clears it between cases. */
export const cacheStore = new Map<string, { value: unknown; lastModified: number }>();

/** Next's cache handler contract, held in memory. */
class MemoryHandler {
  async get(key: string) {
    return cacheStore.get(key) ?? null;
  }
  async set(key: string, value: unknown) {
    cacheStore.set(key, { value, lastModified: Date.now() });
  }
  async revalidateTag() {}
  resetRequestCache() {}
}

const { IncrementalCache } = await import("next/dist/server/lib/incremental-cache");
(globalThis as { __incrementalCache?: unknown }).__incrementalCache = new IncrementalCache({
  dev: false,
  minimalMode: false,
  requestHeaders: {},
  fetchCacheKeyPrefix: "",
  CurCacheHandler: MemoryHandler as never,
  previewProps: { previewModeId: "test" } as never,
  prerenderManifest: { version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [] } as never,
} as never);
