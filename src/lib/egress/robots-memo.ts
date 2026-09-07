// BUILD §6.4
// src/lib/egress/robots-memo.ts — one robots.txt read per origin per scan
// (issue #73).
//
// §6.4's first rule is that nothing is fetched that a scan already holds.
// Since #22 wired robots into `safeFetch`, every call and every redirect hop
// read `/robots.txt` again — about two requests per page fetched, and a deep
// pass fetches up to `MEASURED_PAGES_MAX` of them from one origin. The
// document had to be read; it did not have to be read twenty-five times.
//
// **The scope is the cost context's, and it is opened by
// `withCostContext`.** That is the one thing in this codebase whose lifetime
// *is* a scan: it opens when a pass starts spending and closes when the pass
// is done, so a memo bounded by it cannot serve a stale policy to the next
// scan — the second `Done when` line. `AsyncLocalStorage` is how the scope
// reaches a `safeFetch` twelve frames down without a parameter on every call
// site between; it is `node:async_hooks`, part of Node, so no dependency is
// added (the issue's own note).
//
// **Outside a scope this module does nothing at all.** `memoiseRobots`
// returns the read straight through when no context is open, so
// `readRobots()` called on its own behaves exactly as it did — the third
// `Done when` line — and nothing that runs outside a scan (the publish
// verifier, a one-off) acquires a cache it never asked for.
//
// **The promise is memoised, not the result.** Two page fetches against one
// origin can be in flight at once; keying on the promise means the second
// waits on the first read rather than starting a second one. Keying on the
// settled value would make "at most once" true only when the calls happened
// to be sequential.
//
// **A read that could not be determined is memoised too.** It is still a
// read the scan holds, and re-reading an origin that answers 500 to every
// request is precisely the cost this exists to stop. It fails open, not
// closed: `safeFetch` treats `{ ok: false }` as no policy known and never
// fabricates a disallow (`safe-fetch.ts`'s robots port), so a memoised
// failure withholds nothing from the fetch that follows it.
import { AsyncLocalStorage } from "node:async_hooks";
import type { RobotsPolicy } from "./types";

/** What one origin's read answers — `readRobots`'s own return type. */
type RobotsRead = RobotsPolicy | { ok: false; reason: string };

/** One scan's reads, keyed by origin. A `Map` of in-flight promises; it is
 *  discarded with the scope, and nothing here deletes an entry — the scope
 *  ending is the whole of its lifetime. */
type RobotsMemo = Map<string, Promise<RobotsRead>>;

const scope = new AsyncLocalStorage<RobotsMemo>();

/**
 * Runs `body` with a robots memo open. Called by `withCostContext` and by
 * nothing else in production: the memo's lifetime is a cost context's by
 * definition, and a second opener would be a second definition of how long
 * a scan lasts.
 *
 * **A nested context gets its own memo.** The draft pipeline opens a second
 * context against the scan that grounds the day's page (`rollUp: 'none'`),
 * hours after the scan itself; sharing the outer memo would serve it a
 * policy read at a different time for a different pass. Nesting is rare and
 * a fresh map is the answer that cannot be stale.
 */
export function withRobotsMemo<T>(body: () => Promise<T>): Promise<T> {
  return scope.run(new Map(), body);
}

/**
 * `read()`'s answer for `origin`, read once per scope.
 *
 * With no scope open this is `read()` and nothing else — not a lookup, not
 * a write, no behaviour change of any kind.
 */
export function memoiseRobots(origin: string, read: () => Promise<RobotsRead>): Promise<RobotsRead> {
  const memo = scope.getStore();
  if (memo === undefined) return read();

  const held = memo.get(origin);
  if (held !== undefined) return held;

  // Stored before it settles, so a second caller for this origin waits on
  // this read instead of starting another.
  const started = read();
  memo.set(origin, started);
  return started;
}

/** How many origins this scope has read, or `null` outside one. Exported
 *  for the suite that counts them; production reads nothing here. */
export function robotsMemoSize(): number | null {
  return scope.getStore()?.size ?? null;
}
