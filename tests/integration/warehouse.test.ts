import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("raw_documents dedupes on (subject, hash)", async () => {
  const row = { subject_type: "app", subject_key: "sofa-ios", source_type: "itunes", content_hash: "h1", mode: "ios", body: {} };
  await db.from("raw_documents").insert(row);
  const { error } = await db.from("raw_documents").insert(row);
  expect(error?.code).toBe("23505"); // unique violation
});
