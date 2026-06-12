import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { upsertFactSheet, getFreshFactSheet } from "@/lib/scan/fact-sheets";

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test("upsertFactSheet then getFreshFactSheet returns the body", async () => {
  const subjectKey = `upsert-test-${Date.now()}`;
  const body = { themes: ["onboarding", "pricing"] };

  await upsertFactSheet({
    subjectType: "app",
    subjectKey,
    kind: "review_themes",
    body,
    modelVersion: "claude-3-5-haiku-20241022",
  });

  const result = await getFreshFactSheet("app", subjectKey, "review_themes");
  expect(result).not.toBeNull();
  expect(result?.body).toEqual(body);
});

test("second upsert with same (subjectType, subjectKey, kind) updates — one row, new body", async () => {
  const subjectKey = `upsert-update-${Date.now()}`;
  const bodyV1 = { themes: ["original"] };
  const bodyV2 = { themes: ["updated"] };

  const first = await upsertFactSheet({
    subjectType: "app",
    subjectKey,
    kind: "positioning",
    body: bodyV1,
    modelVersion: "claude-3-5-haiku-20241022",
  });

  const second = await upsertFactSheet({
    subjectType: "app",
    subjectKey,
    kind: "positioning",
    body: bodyV2,
    modelVersion: "claude-3-5-haiku-20241022",
  });

  // Same id — it updated in place.
  expect(second.id).toBe(first.id);

  // getFreshFactSheet returns the new body.
  const result = await getFreshFactSheet("app", subjectKey, "positioning");
  expect(result?.body).toEqual(bodyV2);

  // Exactly one row exists for this (subject_type, subject_key, kind).
  const { data } = await db
    .from("fact_sheets")
    .select("id")
    .eq("subject_type", "app")
    .eq("subject_key", subjectKey)
    .eq("kind", "positioning");
  expect(data?.length).toBe(1);
});

test("getFreshFactSheet returns null for an expired row", async () => {
  const subjectKey = `expired-test-${Date.now()}`;
  const pastExpiry = new Date(Date.now() - 1000).toISOString(); // 1 second in the past

  const { error } = await db.from("fact_sheets").insert({
    subject_type: "app",
    subject_key: subjectKey,
    kind: "keyword_data",
    body: { keywords: ["react"] },
    evidence_ids: [],
    model_version: "claude-3-5-haiku-20241022",
    expires_at: pastExpiry,
    shared: true,
  });
  expect(error).toBeNull();

  const result = await getFreshFactSheet("app", subjectKey, "keyword_data");
  expect(result).toBeNull();
});
