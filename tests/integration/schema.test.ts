import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("core tables exist and apps accepts a row", async () => {
  const { data, error } = await db.from("apps")
    .insert({ store_url: "https://reachkit.app", platform: "web", business_type: "b2c_consumer" })
    .select().single();
  expect(error).toBeNull();
  expect(data?.platform).toBe("web");
});
