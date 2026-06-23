/**
 * dev-auth-session.mjs — mint a local dev login for visual verification of the
 * auth-gated /app dashboard. LOCAL SUPABASE ONLY (127.0.0.1). Not for prod.
 *
 * Creates (or reuses) a test user, links it to the most recent completed demo
 * scan's app so the dashboard shows real data, and prints a /auth/confirm URL
 * whose redirect chain sets the session cookie and lands on /app authed —
 * so a single headless-Chrome navigation can screenshot the live dashboard.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) {
  throw new Error(`Refusing to run against non-local Supabase: ${url}`);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const EMAIL = "design-preview@reachkit.local";

const { data: scan } = await admin
  .from("scans")
  .select("id, app_id")
  .not("completed_at", "is", null)
  .order("completed_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const { data: list } = await admin.auth.admin.listUsers();
let userId = list.users.find((u) => u.email === EMAIL)?.id;
if (!userId) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
  });
  if (error) throw error;
  userId = created.user.id;
}

const appIds = scan?.app_id ? [scan.app_id] : [];
const { error: upErr } = await admin
  .from("users")
  .upsert(
    {
      id: userId,
      email: EMAIL,
      app_ids: appIds,
      tier: "solo",
      // Mark onboarded so /app shows the real dashboard, not the onboarding flow.
      display_name: "Design Preview",
      distribution_goal: "awareness",
      icp_confirmed: ["solo founders", "indie developers", "productivity enthusiasts"],
      onboarded_at: "2026-06-23T00:00:00Z",
    },
    { onConflict: "id" },
  );
if (upErr) throw new Error(`users upsert: ${upErr.message}`);

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr) throw linkErr;

const tokenHash = link.properties.hashed_token;
console.log(
  `CONFIRM_URL=http://localhost:3000/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
);
console.log(`USER_ID=${userId}`);
console.log(`APP_ID=${scan?.app_id ?? "(none)"}`);
console.log(`SCAN_ID=${scan?.id ?? "(none)"}`);
