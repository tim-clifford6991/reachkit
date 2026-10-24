// `node scripts/design/parity.mjs --board <Board> (--file | --url)` prints the board's table.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const SCRIPT = path.resolve(__dirname, "../../../scripts/design/parity.mjs");
const FIXTURES = path.join(__dirname, "fixtures");
const PAGE = path.join(FIXTURES, "page.html");

const EXPECTED = [
  "#### Board",
  "| matched | missing | allowed | baseline |",
  "| 9 | 6 | 0 | — |",
  "- missing: 10 min of your time, once",
  "- missing: 14-day money-back guarantee",
  "- missing: Switch to dark theme",
  "- missing: yourwebsite.com",
  "- missing: Scan my site for free",
  "- missing: Cancel your contract",
];

describe("the parity CLI", () => {
  it("prints matched, missing and allowed counts and every missing string for a local page", async () => {
    const { stdout } = await run(process.execPath, [SCRIPT, "--board", "Board", "--boards", FIXTURES, "--file", PAGE]);
    for (const line of EXPECTED) expect(stdout).toContain(line);
    expect(stdout).not.toContain("unused allow line");
  });

  it("lists an allow line whose string ships, or that the board does not draw, as unused", async () => {
    const { stdout, stderr } = await run(process.execPath, [
      SCRIPT, "--board", "Board", "--boards", FIXTURES, "--allow", FIXTURES, "--file", PAGE,
    ]);
    expect(stdout).toContain("| 9 | 5 | 1 | — |");
    expect(stdout).toContain("- unused allow line: docs/design/parity/Board.allow:1 Pricing (delete it: the string ships)");
    expect(stdout).toContain("- unused allow line: docs/design/parity/Board.allow:2 Austin Plumbing (delete it: the board does not draw it)");
    expect(stdout).not.toContain("- missing: 14-day money-back guarantee");
    expect(stdout).not.toMatch(/unused allow line: .*14-day/);
    expect(stderr).toContain("warning: unused allow line docs/design/parity/Board.allow:1 Pricing");
    expect(stderr).toContain("warning: unused allow line docs/design/parity/Board.allow:2 Austin Plumbing");
  });

  it("reads a page by GET with --url", async () => {
    const methods: string[] = [];
    const server = createServer((req, res) => {
      methods.push(req.method ?? "");
      res.setHeader("content-type", "text/html");
      res.end(readFileSync(PAGE));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${port}/pricing`;
      const { stdout } = await run(process.execPath, [SCRIPT, "--board", "Board", "--boards", FIXTURES, "--url", url]);
      for (const line of EXPECTED) expect(stdout).toContain(line);
      expect(methods).toEqual(["GET"]);
    } finally {
      server.close();
    }
  });

  it("refuses a run with no page to read", async () => {
    await expect(run(process.execPath, [SCRIPT, "--board", "Board"])).rejects.toMatchObject({ code: 2 });
  });
});
