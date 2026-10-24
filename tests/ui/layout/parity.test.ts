// Design parity inside `no overflow · axe`: each canvas board's strings against
// the text the sweep's own server and seeds ship, and a missing count that only
// goes down (docs/PROCESS.md › Gates). One browser for every address, at 1280, light.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  boardFile,
  compare,
  PARITY_DIR,
  readAllow,
  segments,
  sha256,
  table,
  verdict,
} from "../../../scripts/design/parity.mjs";
import { getAccountCookie, getBaseURL, getLiveAccountCookie, getSetupAccountCookie, withPage } from "./browser";

interface Row {
  read: "page" | "hosted" | "mail" | "state";
  paths?: string[];
  account?: "live" | "setup";
  host?: string;
  fixture?: string;
}

const BOARDS = JSON.parse(readFileSync(path.join(PARITY_DIR, "boards.json"), "utf8")) as Record<string, Row>;
const BASELINE = JSON.parse(readFileSync(path.join(PARITY_DIR, "baseline.json"), "utf8")) as Record<
  string,
  { sha256: string; missing: number }
>;

function cookieFor(row: Row): string {
  if (row.account === "live") return getLiveAccountCookie();
  if (row.account === "setup") return getSetupAccountCookie();
  return getAccountCookie();
}

/** Every address the page and hosted rows name, as the visitor reaches it, with its cookie. */
function addresses(baseURL: string): { key: string; url: string; cookie?: string }[] {
  const out = new Map<string, { key: string; url: string; cookie?: string }>();
  for (const row of Object.values(BOARDS)) {
    if (row.read !== "page" && row.read !== "hosted") continue;
    for (const p of row.paths ?? []) {
      const key = keyOf(row, p);
      if (row.read === "hosted") {
        const url = new URL(baseURL + p);
        url.hostname = row.host!;
        out.set(key, { key, url: url.toString() });
      } else {
        // Signed in only where the sweep is: an account page. A public page is read as a stranger.
        const cookie = /^\/(app|setup)([/?]|$)/.test(p) ? cookieFor(row) : undefined;
        out.set(key, { key, url: baseURL + p, cookie });
      }
    }
  }
  return [...out.values()];
}

function keyOf(row: Row, p: string): string {
  return `${row.read === "hosted" ? row.host : (row.account ?? "")} ${p}`;
}

const pages = new Map<string, { status: number; html: string }>();
const ACCOUNT_ERROR = '[data-testid="account-error"]';

beforeAll(async () => {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/parity.test.ts: no app server is running");
  await withPage(1280, async (page) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    for (const { key, url, cookie } of addresses(baseURL)) {
      await page.setExtraHTTPHeaders(cookie ? { Cookie: cookie } : {});
      // A live read that times out on a loaded runner draws the account error screen; read it again.
      for (let attempt = 1; ; attempt++) {
        const response = await page.goto(url);
        const failed = (await page.$(ACCOUNT_ERROR)) !== null;
        if (!failed || attempt === 3) {
          pages.set(key, { status: failed ? 500 : (response?.status() ?? 0), html: await page.content() });
          break;
        }
      }
    }
  });
}, 600_000);

async function shipText(row: Row): Promise<string[]> {
  if (row.read === "page" || row.read === "hosted") {
    return (row.paths ?? []).flatMap((p) => {
      const read = pages.get(keyOf(row, p))!;
      // A hosted page that is gone answers 404 by design; any other page must answer itself.
      if (row.read === "page" && read.status !== 200) throw new Error(`${p} answered ${read.status}, so its board was not read`);
      return segments(read.html);
    });
  }
  if (row.read === "mail") {
    const { applyEnvFixture } = await import("../../mail/env-fixture");
    applyEnvFixture();
    const { composePreview } = await import("../../mail/preview/kinds");
    const mail = await composePreview(row.fixture as Parameters<typeof composePreview>[0]);
    return segments(mail.html);
  }
  const { COPY } = await import("@/lib/presentation/copy");
  return Object.values(COPY).flatMap((value) => String(value).split(/\{[^}]*\}/));
}

const summary: string[] = [];

describe("design parity: a board's missing count only goes down", () => {
  for (const [board, row] of Object.entries(BOARDS)) {
    it(`${board} (${row.read}${row.paths ? ` ${row.paths.join(", ")}` : ""})`, async () => {
      const file = boardFile(board);
      const texts = await shipText(row);
      if (process.env.RK_PARITY_OUT) {
        mkdirSync(process.env.RK_PARITY_OUT, { recursive: true });
        writeFileSync(path.join(process.env.RK_PARITY_OUT, `${board}.txt`), texts.join("\n"), "utf8");
      }
      const result = compare(readFileSync(file, "utf8"), texts, readAllow(board));
      summary.push(table(board, result, BASELINE[board]?.missing));
      const { ok, message } = verdict(board, result.missing, BASELINE[board], sha256(file), result.unused);
      console.log(message);
      expect(ok, message).toBe(true);
    }, 60_000);
  }

  afterAll(() => {
    const out = ["### Design parity (docs/design/parity)", "", ...summary].join("\n");
    console.log(out);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
  });
});
