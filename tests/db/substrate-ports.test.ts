// Issue #296 — a run's block of ports is as wide as the stack it holds.
//
// `up.sh --run` derives a run's ports from a hash of its id with a fixed
// stride. The stride was three and the stack binds four: postgres-meta
// listens on `PG_META_PORT` and starts an admin app on `PG_META_PORT + 1`,
// hard-coded in the package with no setting to move it. So the fourth port a
// run bound was the *next* offset's PostgREST, and every pair of adjacent
// offsets collided — deterministically, not by hash collision. Whichever ran
// second either failed on `EADDRINUSE` inside postgres-meta's own log, or
// took the other run's PostgREST and read its database.
//
// These read the script rather than run it: `up.sh` needs a live PostgreSQL,
// a PostgREST binary and about 170 MB, none of which belongs in the `node`
// project. What is asserted is the arithmetic, which is where the defect was.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const UP = readFileSync(
  path.join(import.meta.dirname, "../../scripts/db-substrate/up.sh"),
  "utf8"
);

/** How many ports the stack actually binds per run: PostgREST, the proxy,
 *  postgres-meta and postgres-meta's admin app. A fifth service means this
 *  number and the script's stride both move, together — which is the whole
 *  point of asserting them against each other. */
const PORTS_BOUND_PER_RUN = 4;

/** The lowest port a run's block may start at, and the ceiling the whole
 *  scheme stays under. Both are `up.sh`'s own numbers. */
const RUN_PORT_FLOOR = 3200;
const RUN_PORT_CEILING = 4000;
const RUN_OFFSETS = 200;

function number(pattern: RegExp): number {
  const match = UP.match(pattern);
  expect(match, `up.sh no longer matches ${String(pattern)}`).not.toBeNull();
  return Number(match?.[1]);
}

describe("scripts/db-substrate/up.sh — the ports one run reserves", () => {
  it("reserves at least as many ports as the stack binds", () => {
    expect(number(/^PORTS_PER_RUN=(\d+)$/m)).toBeGreaterThanOrEqual(PORTS_BOUND_PER_RUN);
  });

  it("leaves postgres-meta's admin port inside the run's own block", () => {
    // The three named ports sit at base + 0, 1, 2, so the admin app's
    // implicit `PGMETA_PORT + 1` is base + 3 — this run's fourth port and
    // not the next run's first.
    const stride = number(/^PORTS_PER_RUN=(\d+)$/m);
    const base = number(/RUN_PORT_BASE=\$\(\( (\d+) \+ RUN_OFFSET \* PORTS_PER_RUN \)\)/);
    expect(base).toBe(RUN_PORT_FLOOR);

    const offsets = { postgrest: 0, proxy: 1, pgmeta: 2 };
    expect(UP).toContain(`POSTGREST_PORT="${"${POSTGREST_PORT:-$(( RUN_PORT_BASE + " + offsets.postgrest + " ))}"}"`);
    expect(UP).toContain(`PROXY_PORT="${"${PROXY_PORT:-$(( RUN_PORT_BASE + " + offsets.proxy + " ))}"}"`);
    expect(UP).toContain(`PGMETA_PORT="${"${PGMETA_PORT:-$(( RUN_PORT_BASE + " + offsets.pgmeta + " ))}"}"`);
    expect(UP).toContain("PGMETA_ADMIN_PORT=$(( PGMETA_PORT + 1 ))");
    expect(offsets.pgmeta + 1).toBeLessThan(stride);

    // And the whole scheme still fits: the last offset's last port.
    expect(base + (RUN_OFFSETS - 1) * stride + stride - 1).toBeLessThan(RUN_PORT_CEILING);
  });

  it("adopts nothing: no service is taken over because its port answered", () => {
    // Every `curl` in this file is now one of two things: the wait that
    // asks whether a service *this run started* has come up, and the refusal
    // that asks whether somebody else is on a port. Neither decides that a
    // listener is ours. The three that did — `if curl …; then log "postgrest
    // already answering"` and its two siblings — are what #296 removed, and
    // counting the probes is what stops a fourth being written.
    expect(UP.match(/^\s*(?:if )?curl /gm) ?? []).toHaveLength(2);
    for (const port of ["POSTGREST_PORT", "PROXY_PORT", "PGMETA_PORT", "PGMETA_ADMIN_PORT"]) {
      expect(UP).toContain(`refuse_if_held "$${port}"`);
    }
  });

  it("remembers every service it starts, so a failed start stops it again", () => {
    // `up.sh` used to exit non-zero with PostgREST and the proxy already
    // running and the state file — written last — naming neither, which is
    // how a human came to `kill` two processes by pid.
    expect(UP).toContain("trap on_exit EXIT");
    for (const service of ["postgrest", "rest-v1-proxy", "postgres-meta"]) {
      expect(UP).toContain(`remember_started ${service} "$`);
    }
    expect(UP).toContain('STARTED_CONTAINERS+=("reachkit-postgrest');
  });
});
