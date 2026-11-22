// AI Mode and ChatGPT keep the site's own cited addresses, so a page they cite counts as linked.
import { describe, expect, it } from "vitest";
import { engineColumns } from "../../../src/lib/market/questions/matrix.ts";
import { measured } from "../../../src/lib/measure/measured.ts";
import { linkedByIn } from "../../../src/lib/measure/page-reading.ts";

const PAGE = "https://content.example.com/example-vs-rival";
const at = new Date("2026-11-16T05:41:01Z");
const answer = measured({ answered: true, citedDomains: ["rival.net", "example.com"], citedUrls: ["https://rival.net/a", PAGE] }, at);
const row = () => ({ publicationId: "pub-1", question: { search: "example vs rival" }, cell: { kind: "no_answer" }, engines: engineColumns({ overview: { kind: "no_answer" }, battery: { aiMode: answer, chatgpt: answer }, ownDomain: "example.com" }) });

describe("a battery engine's citation of the page", () => {
  it("lands as a link for AI Mode and ChatGPT, not a mention", () => {
    expect(linkedByIn({ pageQuestions: { rows: [row()] } }, "pub-1", PAGE)).toEqual(["ai_mode", "chatgpt"]);
  });

  it("a second run over the same answers stores the same cells", () => {
    const [first, again] = [row(), row()];
    expect(again.engines).toEqual(first.engines);
    expect(first.engines[1]?.cell).toHaveProperty("ownUrls", [PAGE]);
  });
});
