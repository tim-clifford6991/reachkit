// tests/ui/layout/browser.test.ts
//
// #105: the layout suite's state file was one fixed path under
// `os.tmpdir()`, shared by every worktree on the machine. Two concurrent
// runs overwrote each other's `baseURL` — tests then probed the other
// branch's app and failed innocent routes — and the first teardown deleted
// the file out from under the second run, which died on a bare `ENOENT`
// from `readFileSync`. These tests hold the three properties that fix
// rests on: the path is this run's alone, it is nobody else's to delete,
// and a missing one says what happened.
import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBaseURL, STATE_FILE_ENV } from "./browser";

/** The path #105 reports: fixed, machine-global, the same string in every
 *  worktree on the box. */
const CLOBBERED_PATH = path.join(os.tmpdir(), "wo-269-layout-browser-state.json");

function withStateFileEnv<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env[STATE_FILE_ENV];
  if (value === undefined) delete process.env[STATE_FILE_ENV];
  else process.env[STATE_FILE_ENV] = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env[STATE_FILE_ENV];
    else process.env[STATE_FILE_ENV] = saved;
  }
}

describe("the layout run's state file", () => {
  it("is this run's own, not a path another worktree can name", () => {
    const stateFile = process.env[STATE_FILE_ENV];
    expect(stateFile).toBeTypeOf("string");
    expect(stateFile).not.toBe(CLOBBERED_PATH);
    // Its own directory, not one shared with every other run on the box —
    // so a concurrent run cannot write this file, and this run's teardown
    // (which removes the directory) cannot take away anyone else's.
    expect(path.dirname(stateFile!)).not.toBe(os.tmpdir());
    expect(readdirSync(path.dirname(stateFile!))).toEqual([path.basename(stateFile!)]);
  });

  it("says the suite was not run through its globalSetup when the env var is missing", () => {
    withStateFileEnv(undefined, () => {
      expect(() => getBaseURL()).toThrow(/npm run test:layout/);
    });
  });

  it("says the run was torn down when the file is gone, rather than a bare ENOENT", () => {
    const gone = path.join(os.tmpdir(), "reachkit-layout-no-such-run", "browser-state.json");
    withStateFileEnv(gone, () => {
      expect(() => getBaseURL()).toThrow(/torn down while a test was still going/);
    });
  });
});
