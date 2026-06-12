import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

test("anon cannot read scans (RLS)", async () => {
  const app = await svc.from("apps").insert({ store_url: "x", platform: "web" }).select().single();
  await svc.from("scans").insert({ app_id: app.data!.id });
  const { data } = await anon.from("scans").select();
  expect(data).toEqual([]);
});

test("anon cannot read users PII (RLS)", async () => {
  await svc.from("users").insert({ email: `rls-${Date.now()}@example.com` });
  const { data } = await anon.from("users").select();
  expect(data).toEqual([]);
});

test("anon cannot read competitors/monitors/score_snapshots/outcomes (service-only)", async () => {
  for (const t of ["competitors", "monitors", "score_snapshots", "outcomes"] as const) {
    const { data } = await anon.from(t).select();
    expect(data).toEqual([]);
  }
});
