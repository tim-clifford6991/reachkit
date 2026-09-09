// tests/presentation/copy/counts.ts — issue #402
//
// The copy ledger, per partition. Until now `registry.test.ts` carried the
// registry's coverage as four hand-maintained totals ("117 owner-owed, 244
// awaiting copy, 364 ruled, 725 total") at the foot of an eight-hundred-line
// running arithmetic commentary. Every screen PR adds keys, so every screen
// PR rewrote the same four literals and appended to the same comment — which
// made every pair of open screen PRs conflict the moment either landed
// (#391, #392, #395, #396 and #399 each paid a rebase for a one-line count).
//
// The coverage is now recorded per partition, in `counts.snapshot.json`, and
// the totals are summed from it. A PR that adds keys to `settings.ts`
// rewrites the `settings.ts` block and nothing else, so two PRs adding keys
// in different domains touch disjoint, non-adjacent regions of one file and
// git merges them with no conflict.
//
// The snapshot is generated, never hand-typed:
//
//     UPDATE_COPY_COUNTS=1 npx vitest run --project node tests/presentation/copy/registry.test.ts
//
// What it records is *names* for the two unwritten standings and a count for
// the ruled one. Names, not a count, because that is what keeps rule 5.5's
// guarantee exact: a key that stops being `TODO(copy)` disappears from a
// named list and the diff says which key it was, where a bare count can be
// held level by one key arriving as the same PR promotes another away. The
// ruled standing needs no names — it is every key that is neither, and
// `COPY` is already that list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TODO_COPY_MARKER } from "../../../src/lib/presentation/copy/registry.ts";
import type { CopyPartition } from "../../../src/lib/presentation/copy/registry.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COPY_DIR = path.resolve(HERE, "../../../src/lib/presentation/copy");
const KEYS_DIR = path.join(COPY_DIR, "keys");

/** The partition files, by name, in sorted order. */
export const KEY_FILES: readonly string[] = fs
  .readdirSync(KEYS_DIR)
  .filter((f) => f.endsWith(".ts"))
  .sort();

/** The generated ledger's path. One JSON block per partition. */
export const LEDGER_PATH = path.join(HERE, "counts.snapshot.json");

/** How to regenerate it, quoted into the failure message so a red run says
 *  what to run rather than what number to type. */
export const UPDATE_COMMAND =
  "UPDATE_COPY_COUNTS=1 npx vitest run --project node tests/presentation/copy/registry.test.ts";

/** Set when the run may rewrite the snapshot instead of asserting against
 *  it — the same convention as the layout suite's `UPDATE_BASELINES`. */
export const UPDATING = process.env.UPDATE_COPY_COUNTS === "1";

export interface PartitionLedger {
  /** Keys whose value is `''` — owner-owed, and `copy()` throws on them. */
  readonly owed: readonly string[];
  /** Keys whose value is the `TODO(copy)` marker — renderable, unwritten. */
  readonly awaiting: readonly string[];
  /** How many of the partition's keys carry an owner sentence. */
  readonly ruled: number;
}

export type CopyLedger = Readonly<Record<string, PartitionLedger>>;

export interface LedgerTotals {
  readonly owed: number;
  readonly awaiting: number;
  readonly ruled: number;
  readonly total: number;
}

/** A partition's exported const, keyed by its own file name, read directly
 *  off disk rather than through `COPY` — `registry.test.ts` needs each
 *  partition in isolation, before the spread merges them, for its
 *  "traces to exactly one partition" and "no cross-partition import"
 *  checks, and the ledger is counted from the same reading. */
export async function loadPartitions(): Promise<Map<string, CopyPartition>> {
  const out = new Map<string, CopyPartition>();
  for (const file of KEY_FILES) {
    const mod: Record<string, CopyPartition> = await import(
      /* @vite-ignore */ `../../../src/lib/presentation/copy/keys/${file}`
    );
    const [exported] = Object.values(mod);
    if (!exported) throw new Error(`${file} exports nothing`);
    out.set(file, exported);
  }
  return out;
}

/** The ledger the registry actually is, in each partition's own declaration
 *  order — so a key appended to a partition file appends here too. */
export function ledgerFrom(partitions: ReadonlyMap<string, CopyPartition>): CopyLedger {
  const out: Record<string, PartitionLedger> = {};
  for (const file of [...partitions.keys()].sort()) {
    const partition = partitions.get(file);
    if (partition === undefined) continue;
    const owed: string[] = [];
    const awaiting: string[] = [];
    let ruled = 0;
    for (const [key, entry] of Object.entries(partition)) {
      const value = entry[0];
      if (value === "") owed.push(key);
      else if (value === TODO_COPY_MARKER) awaiting.push(key);
      else ruled += 1;
    }
    out[file] = { owed, awaiting, ruled };
  }
  return out;
}

/** Rewrite the record. Pretty-printed, one key per line: a partition's
 *  block is separated from its neighbours' by its own closing braces, so
 *  two partitions' edits are never adjacent lines and never conflict. */
export function writeLedger(ledger: CopyLedger): void {
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

/** The four numbers that used to be written down, summed instead. */
export function totalsOf(ledger: CopyLedger): LedgerTotals {
  let owed = 0;
  let awaiting = 0;
  let ruled = 0;
  for (const entry of Object.values(ledger)) {
    owed += entry.owed.length;
    awaiting += entry.awaiting.length;
    ruled += entry.ruled;
  }
  return { owed, awaiting, ruled, total: owed + awaiting + ruled };
}

// The ledger is settled once, here, before any test reads it: under
// `UPDATE_COPY_COUNTS=1` the snapshot is rewritten at import time, so a
// regenerating run and a checking run see exactly the same file and the
// suite never needs a second pass to agree with itself.
export const ACTUAL_LEDGER: CopyLedger = ledgerFrom(await loadPartitions());
if (UPDATING) writeLedger(ACTUAL_LEDGER);

/** The recorded ledger — the registry's stated coverage. */
export const RECORDED_LEDGER: CopyLedger = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as CopyLedger;

/** Its totals. Nothing writes these down; they are the sum. */
export const LEDGER_TOTALS = totalsOf(RECORDED_LEDGER);
