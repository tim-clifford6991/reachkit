// SPEC §7 *A page for what is new in the market*: the dated events a day's write may answer, read at 0¢ from the market
// changes the weekly passes stored. Pure but for `readHotEvents`.
import { createHash } from "node:crypto";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { MarketChange } from "@/lib/scan/weekly/market-changes";
import { readMarketChanges } from "@/lib/scan/weekly/store";

/** The owner's guards (rulings 90 and 91): two independent reports dated within 14 days, and an event cut at a word to 60 characters. */
export const HOT = Object.freeze({ sources: 2, days: 14, eventChars: 60 });

export interface HotClaim {
  url: string;
  publisher: string;
  publishedAt: string;
  quote: string;
  /** The Monday the weekly pass read it on. */
  readOn?: string;
}

/** A new product, model, version, rule or price two publishers reported within `HOT.days` of the day being written. */
export interface HotEvent {
  key: string;
  signal: "news";
  /** What it names, word for word as its sources do, at most `HOT.eventChars`. */
  event: string;
  /** The earliest of its dated reports, `YYYY-MM-DD`. */
  date: string;
  a: string;
  b: string;
  title: string;
  claims: HotClaim[];
}

const DAY_MS = 86_400_000;

/** `text` cut at a word to `max` characters. */
export function cutAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trim();
}

/** The changes' events a page dated `day` may answer, newest first. A change whose name its sources do not carry names nothing. */
export function hotEvents(changes: readonly Partial<MarketChange>[], day: string): HotEvent[] {
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - HOT.days * DAY_MS).toISOString().slice(0, 10);
  const events = new Map<string, HotEvent>();
  for (const change of changes) {
    if (typeof change.names !== "string" || !Array.isArray(change.claims) || !Array.isArray(change.words)) continue;
    const claims = change.claims.filter((claim) => typeof claim?.publishedAt === "string" && claim.publishedAt >= since && claim.publishedAt <= day).map((claim) => ({ ...claim, ...(change.lastSeen === undefined ? {} : { readOn: change.lastSeen }) }));
    const publishers = [...new Map(claims.map((claim) => [registrableDomain(claim.url) ?? claim.url, claim.publisher])).values()];
    const said = [change.title ?? "", ...claims.map((claim) => claim.quote)].join(" ").toLowerCase();
    if (publishers.length < HOT.sources || !said.includes(change.names.trim().toLowerCase())) continue;
    const key = `news:${createHash("sha256").update([...change.words].sort().join(" ")).digest("hex").slice(0, 32)}`;
    const date = claims.map((claim) => claim.publishedAt).sort()[0]!;
    if (!events.has(key)) events.set(key, { key, signal: "news", event: cutAtWord(change.names, HOT.eventChars), date, a: publishers[0]!, b: publishers[1]!, title: change.title ?? "", claims });
  }
  return [...events.values()].sort((x, y) => y.date.localeCompare(x.date));
}

/** The site's events for a page dated `day`, from the stored weeks that could hold a report inside its window. */
export async function readHotEvents(siteId: string, day: string): Promise<HotEvent[]> {
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - (HOT.days + 7) * DAY_MS).toISOString().slice(0, 10);
  const weeks = await readMarketChanges({ siteIds: [siteId], from });
  return hotEvents(weeks.flatMap((week) => week.changes as Partial<MarketChange>[]), day);
}

/** What a placed hot page's reason stores: its event's measured slots, and the date it was detected on. */
export type HotReason = Pick<HotEvent, "signal" | "event" | "date" | "a" | "b" | "key"> & { detectedOn: string };
