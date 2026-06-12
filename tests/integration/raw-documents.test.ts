import { expect, test } from "vitest";
import { upsertRawDocument } from "@/lib/db/raw-documents";

test("upsertRawDocument inserts once, dedupes identical content", async () => {
  const key = `sofa-${Date.now()}`;
  const body = { results: [{ name: "Sofa", rating: 4.8 }] };
  const first = await upsertRawDocument({
    subjectType: "app",
    subjectKey: key,
    sourceType: "itunes",
    body,
    mode: "ios",
  });
  expect(first.deduped).toBe(false);
  const second = await upsertRawDocument({
    subjectType: "app",
    subjectKey: key,
    sourceType: "itunes",
    body: { results: [{ rating: 4.8, name: "Sofa" }] },
    mode: "ios",
  });
  expect(second.deduped).toBe(true); // reordered-but-equal content dedupes
  expect(second.id).toBe(first.id);
});
