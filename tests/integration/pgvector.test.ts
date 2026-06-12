import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Direction-distinct vectors so cosine nearest-neighbour is unambiguous.
const v = (a: number, b: number) => `[${[a, b, ...Array(1022).fill(0)].join(",")}]`;

test("pgvector cosine nearest-neighbour returns the closer-direction row", async () => {
  await db.from("embeddings").insert([
    { subject_type: "review", subject_key: "a", content: "near", embedding: v(1, 0), model: "test", model_version: "1" },
    { subject_type: "review", subject_key: "b", content: "far",  embedding: v(0, 1), model: "test", model_version: "1" },
  ]);
  const { data, error } = await db.rpc("match_embeddings", { query: v(0.9, 0.1), match_count: 1 });
  expect(error).toBeNull();
  expect(data?.[0]?.content).toBe("near");
});
