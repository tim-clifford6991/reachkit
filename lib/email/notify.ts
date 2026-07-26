/**
 * Email delivery orchestration (intake 2026-07-26-email-system) — the ONE place
 * that resolves an app's owner + preferences + data and sends a branded email.
 * Every function here is BEST-EFFORT (never throws) and PREFERENCE-GATED, so a
 * cron/webhook/provision caller stays a one-liner and an email failure can never
 * break the money/scan path. Recipients and numbers are read from the DB the same
 * scan already persisted — no email fabricates a value.
 */
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { sendBrandedEmail } from "@/lib/email/resend";
import { shouldSendEmail, type EmailType } from "@/lib/email/prefs";
import {
  welcomeEmail, scanReadyEmail, weeklyDigestEmail, dailyFocusEmail,
  scoreAlertEmail, subscriptionCanceledEmail,
} from "@/lib/email/messages";


/** A score move must clear this (points) before a midweek score-alert fires. */
const SCORE_ALERT_MIN_DELTA = 3;

export function siteLabel(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, ""); }
}

interface Recipient { userId: string; email: string; prefs: Record<string, unknown> | null; siteLabel: string; storeUrl: string; }

/** Resolve the owner email + prefs + site label for a tracked app, or null. */
async function recipientForApp(appId: string): Promise<Recipient | null> {
  try {
    const db = serverDb();
    const { data: user } = await db
      .from("users")
      .select("id, email, email_prefs")
      .contains("app_ids", [appId])
      .maybeSingle();
    if (!user?.email) return null;
    const { data: app } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
    const storeUrl = (app?.store_url as string | null) ?? "";
    return {
      userId: user.id as string,
      email: user.email as string,
      prefs: (user.email_prefs as Record<string, unknown> | null) ?? null,
      siteLabel: siteLabel(storeUrl),
      storeUrl,
    };
  } catch (e) {
    console.error("[notify] recipientForApp failed", e);
    return null;
  }
}

function formatDelta(d: number, suffix = ""): string | undefined {
  if (d > 0) return `▲ +${d}${suffix}`;
  if (d < 0) return `▼ −${Math.abs(d)}${suffix}`;
  return undefined;
}

/** Current score + week-over-week delta from the two latest snapshots. */
async function scoreDelta(appId: string, suffix = ""): Promise<{ score: number; deltaText?: string; rawDelta: number } | null> {
  try {
    const db = serverDb();
    const { data } = await db
      .from("score_snapshots")
      .select("total, taken_at")
      .eq("app_id", appId)
      .order("taken_at", { ascending: false })
      .limit(2);
    const cur = data?.[0]?.total as number | undefined;
    const prev = data?.[1]?.total as number | undefined;
    if (typeof cur !== "number") {
      // No snapshot yet — fall back to the latest done scan's persisted score.
      const { data: scan } = await db
        .from("scans").select("score_total").eq("app_id", appId).eq("status", "done")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const t = scan?.score_total as number | undefined;
      return typeof t === "number" ? { score: t, rawDelta: 0 } : null;
    }
    const rawDelta = typeof prev === "number" ? cur - prev : 0;
    return { score: cur, deltaText: formatDelta(rawDelta, suffix), rawDelta };
  } catch (e) {
    console.error("[notify] scoreDelta failed", e);
    return null;
  }
}

async function gatedSend(appId: string, type: EmailType, build: (r: Recipient) => Promise<void> | void): Promise<void> {
  const r = await recipientForApp(appId);
  if (!r) return;
  if (!shouldSendEmail(r.prefs, type)) return;
  try { await build(r); } catch (e) { console.error(`[notify] ${type} send failed (best-effort)`, e); }
}

// ---------------------------------------------------------------------------
// Public notify functions — one per trigger
// ---------------------------------------------------------------------------

/** Welcome — first onboarding (called once, from the onboarding action). Resolves
 *  by userId (the app may not exist yet). */
export async function notifyWelcome(userId: string): Promise<void> {
  try {
    const db = serverDb();
    const { data: user } = await db.from("users").select("email, email_prefs").eq("id", userId).maybeSingle();
    if (!user?.email) return;
    if (!shouldSendEmail(user.email_prefs as Record<string, unknown> | null, "welcome")) return;
    await sendBrandedEmail(user.email as string, welcomeEmail({ dashboardUrl: `${env.appUrl}/app/dashboard` }));
  } catch (e) {
    console.error("[notify] welcome failed (best-effort)", e);
  }
}

/** Scan-ready — a deep scan finished for a tracked app. */
export async function notifyScanReady(appId: string): Promise<void> {
  await gatedSend(appId, "scan-ready", async (r) => {
    const sd = await scoreDelta(appId);
    if (!sd) return;
    const [topFix] = await topOpenActions(appId, 1);
    await sendBrandedEmail(r.email, scanReadyEmail({
      siteLabel: r.siteLabel, score: sd.score, topFix,
      reportUrl: `${env.appUrl}/app/dashboard`,
    }));
  });
}

/** This week's top open action titles for the digest's "plan" section. */
async function topOpenActions(appId: string, limit = 3): Promise<string[]> {
  try {
    const { data } = await serverDb()
      .from("actions")
      .select("title")
      .eq("app_id", appId)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(limit);
    return (data ?? []).map((a) => a.title as string).filter(Boolean);
  } catch { return []; }
}

/** Weekly digest — the Monday retention email. `digest` (changes/alerts) comes from
 *  the refresh result; the score, delta, and this week's actions are read here. */
export async function notifyWeeklyDigest(
  appId: string,
  digest: { weekOf: string; changes: string[]; alerts: string[] },
): Promise<void> {
  await gatedSend(appId, "weekly-digest", async (r) => {
    const sd = await scoreDelta(appId, " since last week");
    if (!sd) return;
    const actions = await topOpenActions(appId);
    await sendBrandedEmail(r.email, weeklyDigestEmail({
      siteLabel: r.siteLabel, score: sd.score, deltaText: sd.deltaText, weekOf: digest.weekOf,
      changes: digest.changes, alerts: digest.alerts, actions,
      dashboardUrl: `${env.appUrl}/app/plan`,
    }));
  });
}

/** Score alert — midweek pulse. Only fires on a meaningful move. */
export async function notifyScoreAlert(appId: string): Promise<void> {
  await gatedSend(appId, "score-alert", async (r) => {
    const sd = await scoreDelta(appId);
    if (!sd || Math.abs(sd.rawDelta) < SCORE_ALERT_MIN_DELTA || !sd.deltaText) return;
    await sendBrandedEmail(r.email, scoreAlertEmail({
      siteLabel: r.siteLabel, score: sd.score, deltaText: sd.deltaText,
      dashboardUrl: `${env.appUrl}/app/dashboard`,
    }));
  });
}

/** Daily focus — the single open action scheduled for today. Skips if none. */
export async function notifyDailyFocus(appId: string, today: string): Promise<void> {
  await gatedSend(appId, "daily-focus", async (r) => {
    const db = serverDb();
    const { data: action } = await db
      .from("actions")
      .select("title, why")
      .eq("app_id", appId)
      .eq("status", "pending")
      .eq("scheduled_for", today)
      .order("effort_min", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!action?.title) return; // nothing due today → no email
    await sendBrandedEmail(r.email, dailyFocusEmail({
      action: action.title as string,
      why: (action.why as string | null) ?? undefined,
      planUrl: `${env.appUrl}/app/plan`,
    }));
  });
}

/** Subscription canceled — resolved by email (the app may already be downgraded). */
export async function notifyCanceled(email: string, prefs: Record<string, unknown> | null): Promise<void> {
  try {
    if (!shouldSendEmail(prefs, "subscription-canceled")) return;
    await sendBrandedEmail(email, subscriptionCanceledEmail({ reactivateUrl: `${env.appUrl}/pricing` }));
  } catch (e) {
    console.error("[notify] canceled failed (best-effort)", e);
  }
}
