// The box's one way to start reachkit.app's re-run or test write: its own secret, the owner's daily caps, and a payload no caller composes.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { tellOwner } from "@/lib/mail/ops/incident";
import { isTestSite } from "@/lib/scan/weekly/rerun";
import { localDay, weekStartFor } from "@/lib/scan/weekly/week";

const SITE_DOMAIN = "reachkit.app";
const CLAIM = "box_trigger";
const OCCASION = "box-trigger";
const CAP = { rerun: 2, test: 4 } as const;
const RAN = { rerun: "weekly_rerun", test: "draft_test" } as const;

const Body = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("rerun"), early: z.literal(true).optional() }),
  z.strictObject({ kind: z.literal("test"), date: z.iso.date().optional() }),
]);
type Kind = keyof typeof CAP;

export type Send = (jobId: "weekly/refresh" | "draft/generate", events: readonly { key: string; data: Record<string, unknown> }[]) => Promise<void>;
export type Answer = { status: number; body: Record<string, unknown> };

const sha = (value: string) => createHash("sha256").update(value).digest();
const plusDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const keyOf = (read: string): string => { try { return String((JSON.parse(read) as { key?: unknown }).key ?? ""); } catch { return ""; } };

function authorized(header: string | null, secret: string): boolean {
  const given = /^Bearer (.+)$/.exec(header ?? "")?.[1];
  return given !== undefined && timingSafeEqual(sha(given), sha(secret));
}

/** A flood of unauthenticated calls stores one digest row a UTC day; each is still a log line. */
async function tellUnauthenticated(now: Date): Promise<void> {
  const line = "401 unauthenticated";
  const { count, error } = await dbAdmin().from("ops_events").select("id", { count: "exact", head: true })
    .eq("kind", "owner-digest").eq("read", OCCASION).eq("code", line).gte("at", `${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (error === null && count === 0) await tellOwner(OCCASION, [line]);
}

/** Refused (unset or wrong secret, bad body, switch, window, site, cap) at 0¢ before any claim; else one claimed number, then one send. */
export async function boxTrigger(a: { authorization: string | null; secret: string | undefined; read: () => Promise<string>; now: Date; send: Send }): Promise<Answer> {
  if (a.secret === undefined) return { status: 401, body: { error: "unauthenticated" } };
  if (!authorized(a.authorization, a.secret)) {
    await tellUnauthenticated(a.now);
    return { status: 401, body: { error: "unauthenticated" } };
  }
  let body: z.infer<typeof Body> | null = null;
  try {
    body = Body.parse(JSON.parse(await a.read()));
  } catch {
    // Answered below as a bad body.
  }
  const answer: Answer = body === null ? { status: 400, body: { error: "bad_body" } } : await accepted(body, a.now, a.send).catch(() => ({ status: 503, body: { error: "unavailable" } }));
  await tellOwner(OCCASION, [`${answer.status} ${body?.kind ?? "-"} ${String(answer.body.code ?? answer.body.error ?? "cap")}`]);
  return answer;
}

async function accepted(body: z.infer<typeof Body>, now: Date, send: Send): Promise<Answer> {
  if (env.KILL_SWITCH) return { status: 423, body: { error: "kill_switch" } };
  // The 08:03 draft tick runs inside this window.
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minute >= 450 && minute < 510) return { status: 409, body: { error: "quiet_window" } };
  const db = dbAdmin();
  const sites = await db.from("sites").select("id, domain, timezone").eq("domain", SITE_DOMAIN);
  if (sites.error !== null) throw new Error(`box trigger: could not read the site: ${sites.error.message}`);
  const listed = sites.data.filter((row) => isTestSite(row.id));
  if (listed.length !== 1) return { status: 409, body: { error: "not_a_test_site" } };
  const site = { id: listed[0]!.id, domain: listed[0]!.domain ?? SITE_DOMAIN, zone: listed[0]!.timezone ?? "UTC" };
  const kind: Kind = body.kind;

  const claimed = await db.from("ops_events").select("id", { count: "exact", head: true })
    .eq("kind", CLAIM).eq("site_id", site.id).like("code", `${kind}:%`).gte("at", `${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (claimed.error !== null) throw new Error(`box trigger: could not count the claims: ${claimed.error.message}`);
  const count = claimed.count ?? 0;
  if (count >= CAP[kind]) return { status: 429, body: { kind, count, cap: CAP[kind] } };

  const date = body.kind === "rerun" ? weekOf(site.zone, now, body.early === true) : await publishDateOf(site, now, body.date);
  const prefix = body.kind === "rerun" ? `weekly:${site.id}:${date}:rerun:` : `draft:${site.id}:${date}:test:`;
  const held = await db.from("ops_events").select("read").eq("site_id", site.id).in("kind", [RAN[kind], CLAIM]).or(`code.eq."${date}",code.like."${kind}:${date}:*"`);
  if (held.error !== null) throw new Error(`box trigger: could not read the keys: ${held.error.message}`);
  // One more than any key stored for the prefix, so a dashboard-sent key is never reused.
  const n = 1 + Math.max(0, ...held.data.map((row) => keyOf(row.read)).filter((key) => key.startsWith(prefix)).map((key) => Number(key.slice(prefix.length))).filter(Number.isInteger));
  const key = `${prefix}${n}`, code = `${kind}:${date}:${n}`;

  const claim = await db.rpc("box_trigger_claim", { p_site: site.id, p_code: code, p_read: JSON.stringify({ key }), p_at: now.toISOString() });
  if (claim.error !== null) return { status: 503, body: { error: "unclaimed" } };
  if (claim.data !== true) return { status: 409, body: { error: "retry" } };
  try {
    if (body.kind === "rerun") {
      await send("weekly/refresh", [{ key, data: { siteId: site.id, domain: site.domain, zone: site.zone, weekStart: date, at: now.toISOString(), rerun: true, ...(body.early === true ? { early: true } : {}) } }]);
    } else {
      await send("draft/generate", [{ key, data: { siteId: site.id, publishDate: date, hour: now.toISOString(), test: true } }]);
    }
  } catch {
    return { status: 502, body: { error: "unsent", code } };
  }
  return { status: 202, body: { kind, key, code, count: count + 1, cap: CAP[kind] } };
}

/** The site's current local week, or next Monday's for an early pass. */
function weekOf(zone: string, now: Date, early: boolean): string {
  const week = weekStartFor({ at: now, zone });
  return early ? plusDays(week, 7) : week;
}

/** The asked date within the site-local week ahead, else the earliest open planned date from tomorrow, else tomorrow. */
async function publishDateOf(site: { id: string; zone: string }, now: Date, asked: string | undefined): Promise<string> {
  const today = localDay(now, site.zone), tomorrow = plusDays(today, 1);
  if (asked !== undefined && asked >= today && asked <= plusDays(today, 7)) return asked;
  const planned = await dbAdmin().from("opportunities").select("planned_for").eq("site_id", site.id).eq("status", "open")
    .gte("planned_for", tomorrow).order("planned_for", { ascending: true }).limit(1);
  if (planned.error !== null) throw new Error(`box trigger: could not read the plan: ${planned.error.message}`);
  return planned.data[0]?.planned_for ?? tomorrow;
}
