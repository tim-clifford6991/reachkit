// A public state board draws the header and footer of the page board it names, which the page rows read on the live layout.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { PARITY_DIR, boardFile } from "../../../scripts/design/parity.mjs";
import { partOf } from "./chrome-parts";

const rows = JSON.parse(readFileSync(path.join(PARITY_DIR, "boards.json"), "utf8")) as Record<string, { read: string; chrome?: string }>;

// The one header text that follows the route: the report address adds its Copy link beside the CTA (headerActionFor's copy-link arm).
const ARM = new Set([copy("copy-link.label")]);
const chromeOf = (board: string) => {
  const html = readFileSync(boardFile(board), "utf8");
  return { header: partOf(html, "header").filter((s) => !ARM.has(s)), footer: partOf(html, "footer") };
};

describe("public state boards draw the shared chrome", () => {
  const states = Object.entries(rows).filter(([, row]) => row.read === "state" && row.chrome);

  it.each(states)("chrome: %s", (board, row) => {
    const own = chromeOf(board);
    const ref = chromeOf(row.chrome!);
    expect(own.footer, `${board}'s footer against ${row.chrome}'s`).toEqual(ref.footer);
    expect(own.header, `${board}'s header against ${row.chrome}'s`).toEqual(ref.header);
  });
});
