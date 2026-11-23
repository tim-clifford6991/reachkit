// SPEC §6 *One URL per question*: a topic a live page of ours holds is kept as that page's update, not dropped.
import "./env";
import { expect, it } from "vitest";
import { clusterKey, collapse } from "@/lib/opportunities/cluster";
import { readOpportunity } from "@/lib/opportunities/store";
import { storedWriteRow } from "./stored-write-row";

it("keeps a candidate that folds into a live page, under the page's topic", () => {
  const live = readOpportunity({ ...storedWriteRow("rival.example", "live"), status: "done" });
  const plan = collapse({ existing: [live], candidates: [{ ...live, title: "A fresh angle" }], brandTokens: [] });
  expect([plan.insert.map((row) => [row.title, row.clusterKey]), plan.dismiss]).toEqual([[["A fresh angle", clusterKey("sourdough bakery", [])]], []]);
});
