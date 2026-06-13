/**
 * Integration test for founder-voice capture (Cycle 5 Task 6, §11 rule 7).
 *
 * Real Supabase. Verifies the capture → consumption round-trip: the route's
 * write (serverDb update of users.founder_voice) is picked up by
 * `readFounderVoice(appId)`, which feeds the FORMAT prompt. Also covers
 * clearing the value to null.
 *
 * Route-level auth is thin (requireUser) and isn't exercised here — we test the
 * lib round-trip + the exact update the route performs, not a faked cookie session.
 *
 * Run with: pnpm test:int tests/integration/founder-voice.test.ts
 */

import { afterAll, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { serverDb } from "@/lib/db/client";
import { readFounderVoice } from "@/lib/llm/actions";

const createdUserIds: string[] = [];

async function seedUser(appId: string): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({
      email: `founder-voice-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      tier: "solo",
      app_ids: [appId],
    })
    .select("id")
    .single();
  if (error) throw error;
  createdUserIds.push(data.id);
  return data.id;
}

// Mirrors exactly what app/api/app/voice/route.ts does after auth + zod/trim.
async function saveVoice(userId: string, value: string | null): Promise<void> {
  const db = serverDb();
  const { error } = await db
    .from("users")
    .update({ founder_voice: value })
    .eq("id", userId);
  if (error) throw error;
}

afterAll(async () => {
  const db = serverDb();
  for (const id of createdUserIds) {
    await db.from("users").delete().eq("id", id);
  }
});

test("captured voice round-trips: saved string is what readFounderVoice returns", async () => {
  const appId = randomUUID();
  const userId = await seedUser(appId);

  // Before capture: no voice set → null.
  expect(await readFounderVoice(appId)).toBeNull();

  // Capture (what the route writes).
  const voice =
    "We're two builders shipping fast and talking to every user. Plain, direct, no jargon.";
  await saveVoice(userId, voice);

  // Consumption side (what generateActions reads → FORMAT prompt).
  expect(await readFounderVoice(appId)).toBe(voice);
});

test("empty voice clears the value to null", async () => {
  const appId = randomUUID();
  const userId = await seedUser(appId);

  await saveVoice(userId, "Some founder voice to be cleared.");
  expect(await readFounderVoice(appId)).not.toBeNull();

  // The route converts empty/whitespace input to null before writing.
  await saveVoice(userId, null);
  expect(await readFounderVoice(appId)).toBeNull();
});
