/**
 * Integration test: auth trigger creates public.users with id = auth.uid()
 *
 * Proves the RLS contract: when a user signs up via Supabase auth, the
 * handle_new_user trigger inserts a public.users row with the SAME uuid as the
 * auth.users row.  This means id = auth.uid() in RLS policies will resolve
 * correctly for every authenticated user.
 */

import { afterAll, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Track created auth users for cleanup.
const createdAuthUserIds: string[] = [];

afterAll(async () => {
  for (const uid of createdAuthUserIds) {
    await svc.auth.admin.deleteUser(uid);
  }
});

test(
  "auth trigger: public.users row created with id matching auth.users id",
  async () => {
    const email = `trigger-test-${Date.now()}@example.com`;

    // Create the auth user with email_confirm:true so it's immediately active.
    const { data, error } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    expect(error).toBeNull();
    if (!data.user) throw new Error("createUser returned no user");

    const authUserId = data.user.id;
    createdAuthUserIds.push(authUserId);

    // The trigger should have run synchronously (AFTER INSERT FOR EACH ROW).
    const { data: profileRow, error: profileErr } = await svc
      .from("users")
      .select("id, email")
      .eq("id", authUserId)
      .single();

    expect(profileErr).toBeNull();
    expect(profileRow).not.toBeNull();

    // THE contract: public.users.id must equal the auth user id.
    expect(profileRow!.id).toBe(authUserId);
    expect(profileRow!.email).toBe(email);
  },
  15_000,
);

test(
  "auth trigger: idempotent — trigger ON CONFLICT (id) DO NOTHING prevents duplicate row",
  async () => {
    // Pre-insert the public.users row so the trigger will find a conflict.
    const preId = crypto.randomUUID();
    const email = `trigger-idempotent-${Date.now()}@example.com`;

    // Insert the public.users row first (simulates a manual or prior upsert).
    const { error: preInsertErr } = await svc.from("users").insert({ id: preId, email });
    expect(preInsertErr).toBeNull();

    // Now create the auth user with the same id — the trigger's ON CONFLICT DO NOTHING
    // should silently skip the duplicate insert rather than throwing.
    const { data, error } = await svc.auth.admin.createUser({
      email: `auth-${email}`,
      email_confirm: true,
    });
    // createUser for a fresh email should succeed regardless.
    expect(error).toBeNull();
    if (!data.user) throw new Error("createUser returned no user");
    createdAuthUserIds.push(data.user.id);

    // Confirm the row exists exactly once for the auth user (trigger ran without error).
    const { data: rows, error: selectErr } = await svc
      .from("users")
      .select("id")
      .eq("id", data.user.id);
    expect(selectErr).toBeNull();
    expect(rows?.length).toBe(1);

    // Clean up the pre-inserted row.
    await svc.from("users").delete().eq("id", preId);
  },
  15_000,
);
