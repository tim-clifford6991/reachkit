// Settings › Your Business states each figure once: over the fixtures, no two numbers that should agree differ, no
// past line reads as future, and every dated line names the product's own next weekly pass.
import { describe, expect, it } from "vitest";
import { businessScreen, type Line } from "@/app/(account)/app/settings/business-screen";
import { FIXTURE_BUSINESS_PROFILE, FIXTURE_KNOWLEDGE, FIXTURE_MARKET_READING } from "@/app/(account)/app/settings/business-fixture";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { marketFigures } from "@/app/(account)/app/settings/market-figures";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { BATTERY } from "@/lib/config/constants";
import { nextDueAfter } from "@/lib/scan/weekly/week";
import { confirmedProfile, profileIsEmpty } from "@/lib/site-profile/business/confirm";
import { NO_EDITS } from "@/lib/site-profile/business/types";
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";

const profile = confirmedProfile({ profile: FIXTURE_BUSINESS_PROFILE, market: FIXTURE_MARKET_READING, edits: NO_EDITS });
const knowledge = knowledgeBase({ stored: FIXTURE_KNOWLEDGE, answers: {} });
const ZONE = FIXTURE_SETTINGS_FACTS.timeZone;

function screenAt(now: Date, competitors: readonly string[], measured: readonly string[]) {
  const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, now, competitors, measuredRivals: measured });
  const card = (n: number) => ({ rivals: measured.map((domain, at) => ({ domain, count: at })), you: { domain: "you", count: n }, of: 12, noRival: false });
  const figures = marketFigures({ competitors, measured, firstPage: card(3), named: card(5) });
  return businessScreen({
    now,
    timeZone: ZONE,
    business: { profile, knowledge, empty: profileIsEmpty(profile) },
    kind: null,
    market: { settings, searches: 12, questions: 24, figures, leaders: [] },
    voice: settings,
  });
}

const NOWS = ["2026-09-15T14:00:00Z", "2026-11-23T05:00:00Z", "2026-11-23T20:00:00Z", "2026-11-29T23:30:00Z"].map((at) => new Date(at));
const SETS = [
  { competitors: FIXTURE_SETTINGS_FACTS.competitors, measured: FIXTURE_SETTINGS_FACTS.competitors },
  { competitors: ["a.com", "b.com", "c.com", "d.com", "e.com"], measured: ["a.com", "b.com"] },
  { competitors: [], measured: [] },
];

const number = (text: string, after: string): number => Number(new RegExp(`(\\d+) ${after}`).exec(text)?.[1]);

describe("Your Business: one figure, one week", () => {
  for (const now of NOWS) {
    for (const set of SETS) {
      it(`${now.toISOString()} with ${set.competitors.length} competitors`, () => {
        const s = screenAt(now, set.competitors, set.measured);
        const market = s.market!;
        const rivals = s.competitors!;

        // Counts that name one set agree.
        expect(rivals.rows).toHaveLength(set.competitors.length);
        expect(rivals.taken).toBe(set.competitors.length);
        expect(rivals.count.startsWith(`${set.competitors.length} of ${BATTERY.COMPETITORS_MAX}`)).toBe(true);
        expect(number(market.checked!, "competitors")).toBe(set.competitors.length);
        expect(rivals.full).toBe(set.competitors.length >= BATTERY.COMPETITORS_MAX);

        // A list's "+n" and the questions count are the lists' own lengths.
        const lines: Line[] = [...s.read!.lines, ...s.voice!.lines];
        for (const line of lines) {
          if (line.value.kind !== "list") continue;
          const total = line.value.full.split(" · ").length;
          expect(line.value.more, line.id).toBe(total > 2 ? `+${total - 2}` : null);
        }
        const asks = lines.find((line) => line.id === "asks")!.value;
        expect(asks.kind === "text" ? number(asks.text, "questions?") : 0).toBe(knowledge.questions.length);

        // One week: every dated line names the next weekly pass, which is after now and within a week of it.
        const due = nextDueAfter({ at: now, zone: ZONE });
        expect(market.nextAt).toEqual(due);
        expect(due.getTime()).toBeGreaterThan(now.getTime());
        expect(due.getTime() - now.getTime()).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);
        const day = market.next.replace("Next check ", "");
        expect(market.domainLead).toContain(day);
        for (const row of rivals.rows) if (row.pending !== null) expect(row.pending).toContain(day);
        const weekday = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "long" }).format(due);
        expect(market.checked).toContain(`every ${weekday}`);

        // The past stays past: the last read is no later than now, and only it says "Last read".
        expect(s.read!.readAt!.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(s.read!.lastRead.startsWith("Last read")).toBe(true);
        expect(market.next.startsWith("Next check")).toBe(true);
      });
    }
  }
});
