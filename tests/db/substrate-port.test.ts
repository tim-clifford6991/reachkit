// The local DB rig's port is the caller's: `RK_DB_PORT` moves both the test
// process and `up.sh`, and leaving it unset keeps the shared 5432.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const UP = join(__dirname, "../../scripts/db-substrate/up.sh");

function printEnv(env: Record<string, string>): Record<string, string> {
  const out = execFileSync("bash", [UP, "--print-env", "--run", "port_probe"], {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
  return Object.fromEntries(
    out
      .trim()
      .split("\n")
      .map((line) => line.replace(/^export /, "").split(/=(.*)/s).slice(0, 2) as [string, string]),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("substrate.ts reads RK_DB_PORT", () => {
  it("defaults to 5432 when unset", async () => {
    vi.stubEnv("RK_DB_PORT", undefined);
    const substrate = await import("./substrate");
    expect(substrate.DB_PORT).toBe("5432");
    expect(substrate.DATABASE_URL).toContain("@127.0.0.1:5432/");
  });

  it("carries RK_DB_PORT into DB_PORT and DATABASE_URL", async () => {
    vi.stubEnv("RK_DB_PORT", "55432");
    const substrate = await import("./substrate");
    expect(substrate.DB_PORT).toBe("55432");
    expect(substrate.DATABASE_URL).toContain("@127.0.0.1:55432/");
  });
});

describe("up.sh --print-env", () => {
  it("exports RK_DB_PORT and a DATABASE_URL on that port", () => {
    const env = printEnv({ RK_DB_PORT: "55432" });
    expect(env.RK_DB_PORT).toBe("55432");
    expect(env.DATABASE_URL).toBe("postgresql://reachkit:reachkit@127.0.0.1:55432/reachkit_scratch_port_probe");
  });

  it("keeps DB_PORT as a fallback and 5432 as the default", () => {
    expect(printEnv({ DB_PORT: "55433" }).RK_DB_PORT).toBe("55433");
    expect(printEnv({}).DATABASE_URL).toBe("postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch_port_probe");
  });
});
