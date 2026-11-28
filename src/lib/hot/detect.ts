// SPEC §7 *A page for what is new in the market*: the dated events a week ranks and a page cites, read at 0¢ from the market
// changes the weekly passes stored. Pure but for `storedChanges`.
import { createHash } from "node:crypto";
import { LANGUAGE_PACKS } from "@/lib/locale/language";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { MarketFact } from "@/lib/generate/pipeline/research";
import { names } from "@/lib/generate/rules/title";
import { topicWords } from "@/lib/opportunities/intent";
import type { Opportunity } from "@/lib/opportunities/types";
import { sameTopic, type MarketChange } from "@/lib/scan/weekly/market-changes";
import { readMarketChanges } from "@/lib/scan/weekly/store";
import { factOf, hotFacts } from "./facts";

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
  /** What happened, in its sources' words, at most `HOT.eventChars`: its headline, or a quoted sentence with the figure the headline lacks. */
  event: string;
  /** What it names, word for word as its sources do, at most `HOT.eventChars`. */
  names: string;
  /** The earliest of its dated reports, `YYYY-MM-DD`. */
  date: string;
  a: string;
  b: string;
  title: string;
  claims: HotClaim[];
  /** Why it ranks lower, where its change is weak. */
  weak?: MarketChange["weak"];
}

const DAY_MS = 86_400_000;
const STOP_WORDS = new Set(LANGUAGE_PACKS.flatMap((pack) => [...pack.stopWords]));

/** `text` cut at a word to `max` characters, never ending on a stop word of any language. */
export function cutAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1), words = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trim().split(" ");
  while (words.length > 1 && STOP_WORDS.has(words.at(-1)!.toLowerCase())) words.pop();
  return words.join(" ").replace(/[,;:–—-]+$/, "");
}

/** A figure beyond a bare year. */
const figured = (text: string): boolean => /\d/.test(text.replace(/\b(?:19|20)\d{2}\b/g, ""));

/** What happened: the headline cut at a word, or where that holds no figure, the first quoted sentence that names `named` and holds one. */
function happened(title: string, named: string, quotes: readonly string[]): string {
  const head = cutAtWord(title === "" ? named : title, HOT.eventChars), name = named.trim().toLowerCase();
  if (figured(head)) return head;
  const sentence = quotes.flatMap((quote) => quote.split(/(?<=[.!?])\s+/)).filter((text) => text.toLowerCase().includes(name)).map((text) => cutAtWord(text.replace(/[.!?]$/, ""), HOT.eventChars)).find(figured);
  return sentence ?? head;
}

/** The story's publishers, the one the others' reports name first, then by its earliest report: the original before who relays it. */
function publishersOf(claims: readonly HotClaim[]): string[] {
  const host = (claim: HotClaim) => registrableDomain(claim.url) ?? claim.url, hosts = [...new Set(claims.map(host))];
  const first = (at: string) => claims.find((claim) => host(claim) === at)!, earliest = (at: string) => claims.filter((claim) => host(claim) === at).map((claim) => claim.publishedAt).sort()[0]!;
  const cited = (at: string) => claims.some((claim) => host(claim) !== at && [at, first(at).publisher].some((name) => names(claim.quote, name)));
  return hosts.sort((x, y) => Number(cited(y)) - Number(cited(x)) || earliest(x).localeCompare(earliest(y))).map((at) => first(at).publisher);
}

/** The changes' events a page dated `day` may answer, newest first: named by what the change names, else by its title, and said by its headline. A name its sources do not carry names nothing. */
export function hotEvents(changes: readonly Partial<MarketChange>[], day: string): HotEvent[] {
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - HOT.days * DAY_MS).toISOString().slice(0, 10);
  const events = new Map<string, HotEvent>();
  for (const change of changes) {
    const named = typeof change.names === "string" ? change.names : (change.title ?? "");
    if (named.trim() === "" || !Array.isArray(change.claims) || !Array.isArray(change.words)) continue;
    const claims = change.claims.filter((claim) => typeof claim?.publishedAt === "string" && claim.publishedAt >= since && claim.publishedAt <= day).map((claim) => ({ ...claim, ...(change.lastSeen === undefined ? {} : { readOn: change.lastSeen }) }));
    const publishers = publishersOf(claims);
    const said = [change.title ?? "", ...claims.map((claim) => claim.quote)].join(" ").toLowerCase();
    if (publishers.length < HOT.sources || (typeof change.names === "string" && !said.includes(change.names.trim().toLowerCase()))) continue;
    const key = `news:${createHash("sha256").update([...change.words].sort().join(" ")).digest("hex").slice(0, 32)}`;
    const date = claims.map((claim) => claim.publishedAt).sort()[0]!;
    if (!events.has(key)) events.set(key, { key, signal: "news", event: happened(change.title ?? "", named, claims.map((claim) => claim.quote)), names: cutAtWord(named, HOT.eventChars), date, a: publishers[0]!, b: publishers[1]!, title: change.title ?? "", claims, ...(change.weak === undefined ? {} : { weak: change.weak }) });
  }
  return [...events.values()].sort((x, y) => y.date.localeCompare(x.date));
}

/** The site's stored market changes that could hold a report inside `day`'s window. */
export async function storedChanges(siteId: string, day: string): Promise<Partial<MarketChange>[]> {
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - (HOT.days + 7) * DAY_MS).toISOString().slice(0, 10);
  return (await readMarketChanges({ siteIds: [siteId], from })).flatMap((week) => week.changes as Partial<MarketChange>[]);
}

/** The site's events for a page dated `day`. */
export const readHotEvents = async (siteId: string, day: string): Promise<HotEvent[]> => hotEvents(await storedChanges(siteId, day), day);

/** What a timely page's reason stores: its event's measured slots, and the Monday it was offered on. */
export type HotReason = Pick<HotEvent, "signal" | "event" | "date" | "a" | "b" | "key"> & { detectedOn: string; /** What its title names; absent on a row stored before it. */ names?: string };

/** The page's own event's reports, then the reports of `HOT.days` before `day` of each stored change that is its topic by
 *  the rule two changes are one story by, newest first and each address once. Pure. */
export function recentFacts(o: Pick<Opportunity, "targetQuery" | "absorbedQueries" | "title"> & { evidence?: Opportunity["evidence"] }, changes: readonly Partial<MarketChange>[], day: string): MarketFact[] {
  const topic = topicWords([o.targetQuery ?? "", ...o.absorbedQueries, o.title ?? ""].join(" "));
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - HOT.days * 86_400_000).toISOString().slice(0, 10);
  const own = hotFacts(o), seen = new Set(own.map((fact) => fact.url));
  const shared = changes.flatMap((change) =>
    !Array.isArray(change.words) || !Array.isArray(change.claims) || !sameTopic(new Set(change.words), topic) ? [] : change.claims.map((claim) => ({ ...claim, ...(change.lastSeen === undefined ? {} : { readOn: change.lastSeen }) }))
  );
  const fresh = shared.filter((claim) => typeof claim?.publishedAt === "string" && claim.publishedAt >= since && claim.publishedAt <= day && !seen.has(claim.url) && seen.add(claim.url));
  return [...own, ...fresh.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(factOf)];
}
