/**
 * check-live-config.mts — cloud-config drift tripwire (`pnpm check:live`).
 *
 * WHY THIS EXISTS
 * ----------------
 * The consistency harness pins code↔docs↔design (`check:arch`, `check:design`,
 * doc tripwires), but nothing pins code↔CLOUD CONFIG. That blind spot produced
 * the 2026-07-15 launch review's one silent revenue-killer: the live Stripe
 * webhook endpoint pointed at the dead `reachkit-pi.vercel.app` domain for
 * weeks and no gate could ever have caught it, because no gate looks outward.
 * This script is `check:design` for the cloud: every externally-configured
 * value the code depends on gets a machine assertion.
 *
 * Failure modes this closes (all real, all from this project's history):
 * webhook URL drift (2026-07-15), Inngest Cloud silent stale sync (2026-07-08
 * and 2026-07-15), price-id/env drift (the WS5 "still USD after merge" class),
 * prod deploy serving a stale commit / broken DB.
 *
 * WHERE IT RUNS
 * -------------
 * - CI `live-smoke` job (workflow_dispatch-only — it makes real Stripe API
 *   reads and needs a LIVE key; use a read-only RESTRICTED key, see ci.yml).
 * - Manually, as the post-incident verifier: after ANY Stripe/Vercel/Inngest
 *   dashboard change, run `pnpm check:live` instead of trusting the click.
 *
 * USAGE
 * -----
 *   STRIPE_SECRET_KEY=rk_live_… STRIPE_PRICE_SOLO=price_… STRIPE_PRICE_GROWTH=price_… \
 *     pnpm check:live
 *
 * Structure mirrors scripts/check-design-parity.mjs: numbered sections,
 * accumulate ALL failures, print everything, exit non-zero at the end — never
 * die on the first check, so one run reports the whole drift picture.
 */
import Stripe from "stripe";

const PROD = "https://reachkit.app";
const failures: string[] = [];
const warnings: string[] = [];
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const warn = (msg: string) => {
  warnings.push(msg);
  console.log(`  ⚠ ${msg}`);
};

// ── 1. Prod freshness + health ────────────────────────────────────────────
console.log("1. prod health");
const health = await fetch(`${PROD}/api/health`)
  .then((r) => r.json())
  .catch(() => null);
if (!health || health.db !== "ok") fail(`/api/health not ok: ${JSON.stringify(health)}`);
else ok(`health ok — commit ${health.commit}, region ${health.region}`);

// ── 2 + 3. Stripe (webhook endpoint + prices) ─────────────────────────────
// Must match the switch in lib/billing/webhook.ts (handleStripeEvent). There
// is NO trial, so `customer.subscription.trial_will_end` is intentionally
// absent (Task 0.1 removed it from the endpoint too).
const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];
const PRICE_ENVS = [
  "STRIPE_PRICE_SOLO",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_SOLO_ANNUAL",
  "STRIPE_PRICE_GROWTH_ANNUAL",
];

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.log("2. stripe webhook endpoint");
  fail("STRIPE_SECRET_KEY unset — cannot check the live webhook endpoint");
  console.log("3. stripe prices");
  fail("STRIPE_SECRET_KEY unset — cannot check prices");
} else {
  const stripe = new Stripe(stripeKey);

  // ── 2. Stripe webhook endpoint points at prod ───────────────────────────
  console.log("2. stripe webhook endpoint");
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
    const enabled = endpoints.data.filter((e) => e.status === "enabled");
    const prodEp = enabled.find((e) => e.url.startsWith(`${PROD}/`));
    if (!prodEp) {
      fail(
        `no ENABLED webhook endpoint on ${PROD} — endpoints: ${enabled.map((e) => e.url).join(", ") || "none"}`,
      );
    } else {
      ok(`endpoint ${prodEp.url}`);
      const events: string[] = prodEp.enabled_events ?? [];
      const missing = events.includes("*") ? [] : HANDLED_EVENTS.filter((ev) => !events.includes(ev));
      if (missing.length) fail(`endpoint missing handled events: ${missing.join(", ")}`);
      else ok("all 4 handled events enabled");
      const stale = enabled.filter((e) => !e.url.startsWith(`${PROD}/`));
      for (const e of stale) warn(`extra enabled endpoint pointing elsewhere: ${e.url} (disable it?)`);
    }
  } catch (e) {
    fail(`webhook endpoint list failed (key mode/permissions?): ${e instanceof Error ? e.message : e}`);
  }

  // ── 3. Stripe prices resolve, active, EUR, no trial ─────────────────────
  console.log("3. stripe prices");
  for (const name of PRICE_ENVS) {
    const id = process.env[name];
    if (!id) {
      if (name.endsWith("_ANNUAL")) warn(`${name} unset (annual optional)`);
      else fail(`${name} unset`);
      continue;
    }
    try {
      const p = await stripe.prices.retrieve(id);
      if (!p.active) fail(`${name} (${id}) is INACTIVE`);
      else if (p.currency !== "eur") fail(`${name} (${id}) is ${p.currency}, expected eur`);
      else if (p.recurring?.trial_period_days) fail(`${name} (${id}) has a trial — trial was removed (P2/#62)`);
      else ok(`${name} → ${(p.unit_amount ?? 0) / 100} ${p.currency}/${p.recurring?.interval}`);
    } catch {
      fail(`${name} (${id}) does not resolve in this Stripe mode`);
    }
  }
}

// ── 4. Inngest registration is current ────────────────────────────────────
console.log("4. inngest sync");
const inngest = await fetch(`${PROD}/api/inngest`, { method: "PUT" })
  .then((r) => r.json())
  .catch(() => null);
if (!inngest || inngest.message !== "Successfully registered") {
  fail(`PUT /api/inngest failed: ${JSON.stringify(inngest)}`);
} else if (inngest.modified) {
  warn("Inngest WAS stale — this PUT fixed it, but auto-sync-on-deploy drifted again");
} else {
  ok("Inngest registration current (modified: false)");
}

// ── 5. Public pricing surface is EUR ───────────────────────────────────────
console.log("5. live pricing page");
const pricingHtml = await fetch(`${PROD}/pricing`)
  .then((r) => r.text())
  .catch(() => "");
if (!pricingHtml.includes("€59")) fail("/pricing does not render €59 — price copy or deploy drift");
else ok("/pricing renders €59");

// ── verdict ────────────────────────────────────────────────────────────────
console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s)`);
for (const f of failures) console.log(`  FAIL: ${f}`);
for (const w of warnings) console.log(`  warn: ${w}`);
if (failures.length) process.exit(1);
console.log("live config matches code expectations ✅");
