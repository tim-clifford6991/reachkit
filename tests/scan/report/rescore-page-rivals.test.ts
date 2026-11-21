// The re-score job fills a stored page question's rivals from the answer text `fetches` kept, once: run again, it writes nothing.
import { expect, it } from "vitest";
import { rescoreStored, type RescoreStore } from "../../../src/lib/scan/rescore-run";
import { apply, fixture, storeOf } from "./rescore-store";

const question = "Which tool connects Slack to Gmail?";
const scan = fixture("zapier.com");
const engines = [
  { engine: "ai_overview", cell: { kind: "no_answer" } },
  { engine: "ai_mode", cell: { kind: "answered", citedDomains: ["g2.com"], namesCustomer: false } },
  // Answered, but its text is not stored: never fillable, and read once only.
  { engine: "chatgpt", cell: { kind: "answered", citedDomains: [], namesCustomer: false } },
];
const row = { publicationId: "p1", liveUrl: "https://zapier.com/blog/a", question: { n: 13, wording: { source: "model", text: question }, search: "slack to gmail" }, cell: { kind: "no_answer" }, engines };
const report = { ...scan.report, tier: "weekly", pageQuestions: { measuredAt: scan.createdAt, ownDomain: "zapier.com", tracked: 13, cap: 30, retired: [], rows: [row] } };
const site = { id: "site", domain: "zapier.com", competitors: [], market: { current: { rivals: [{ name: "Make", domain: "make.com" }, { name: "n8n", domain: "n8n.io" }] } } };

it("a non-current weekly report gains the rivals its stored AI Mode answer named, and a second apply reads and changes nothing", async () => {
  const db = storeOf([{ ...scan, report }], [site]);
  db.rows.set(scan.id, { ...db.rows.get(scan.id)!, siteId: "site" });
  const stored = { source: "serp/google/ai_mode", key: `${question}|United States|en|site:x`, text: "Make and Zapier both do it.", citedUrls: [] };
  const asked: string[] = [];
  const store: RescoreStore = { ...db.store, answers: async (id, keep) => (asked.push(id), [stored].filter((s) => keep?.(s.key) ?? true)) };
  await rescoreStored(store, apply);
  const written = (db.rows.get(scan.id)!.report as typeof report).pageQuestions.rows[0]!.engines as { rivals?: string[] }[];
  expect(written.map((e) => e.rivals)).toEqual([undefined, ["make.com"], undefined]);
  expect(await rescoreStored(store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
  expect(asked).toEqual([scan.id]);
});
