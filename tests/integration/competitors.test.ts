import { expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { persistCompetitors } from "@/lib/scan/competitors";

test("persistCompetitors writes rows for an app", async () => {
  const db = serverDb();
  const app = await db
    .from("apps")
    .insert({ store_url: "https://acme.example", platform: "web" })
    .select("id")
    .single();
  await persistCompetitors(app.data!.id, [
    { name: "Habitify", url: "https://habitify.me", source: "tavily", rank: 1 },
  ]);
  const { data } = await db
    .from("competitors")
    .select("name")
    .eq("app_id", app.data!.id);
  expect(data?.map((r) => r.name)).toContain("Habitify");
});
