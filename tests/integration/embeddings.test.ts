/**
 * Integration test: embedding upsert + semantic search
 *
 * Runs against the local Supabase instance (requires .env.local with
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).
 *
 * Forces fixtures mode via vi.mock so no Voyage API key is needed.
 * fixtureEmbed produces deterministic 1024-dim vectors for semantic assertions.
 */
import { expect, test, vi } from "vitest";

// Force fixtures mode before any module under test is imported.
vi.mock("@/lib/dev/fixtures", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/dev/fixtures")>();
  return { ...original, fixturesEnabled: () => true };
});

import { callEmbed } from "@/lib/llm/embed";
import { insertEmbeddings, searchSimilar } from "@/lib/scan/embeddings";

// Unique subject_key prefix so parallel test runs don't cross-contaminate.
const prefix = `embed-int-test-${Date.now()}`;

test("insertEmbeddings + searchSimilar returns near text as top match", async () => {
  const texts = ["near text", "far text"];
  const [nearVec, farVec] = await callEmbed(texts);

  // Both vectors should be 1024-dim
  expect(nearVec).toHaveLength(1024);
  expect(farVec).toHaveLength(1024);

  await insertEmbeddings([
    {
      subjectType: "test",
      subjectKey: `${prefix}-near`,
      content: "near text",
      embedding: nearVec ?? [],
      model: "fixture",
      modelVersion: "1",
    },
    {
      subjectType: "test",
      subjectKey: `${prefix}-far`,
      content: "far text",
      embedding: farVec ?? [],
      model: "fixture",
      modelVersion: "1",
    },
  ]);

  // Query with the "near text" vector, filtered to subject_type "test"
  const queryVec = await callEmbed(["near text"]);
  const results = await searchSimilar(queryVec[0] ?? [], {
    subjectType: "test",
    k: 2,
  });

  expect(results.length).toBeGreaterThanOrEqual(1);
  expect(results[0]?.content).toBe("near text");
  expect(results[0]?.similarity).toBeGreaterThan(0.99); // ~1.0 for identical vector
}, 30_000);

test("searchSimilar with p_app_id filter returns empty when no match", async () => {
  const [vec] = await callEmbed(["probe text"]);
  // Use a random uuid that doesn't exist in the apps table — the FK is nullable
  // so we just pass appId that won't match any row we inserted.
  const results = await searchSimilar(vec ?? [], {
    appId: "00000000-0000-0000-0000-000000000001",
    k: 5,
  });
  // Should return no rows because no embeddings are linked to this fake app_id
  expect(results).toHaveLength(0);
}, 15_000);
