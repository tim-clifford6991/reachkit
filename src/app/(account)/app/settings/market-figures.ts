// Settings › Market's competitor figures, picked from the Competitors tab's own
// cards (`readRivals().firstPage` and `namedOf`), never counted again here.
import type { PresenceCard } from "../_overview/rivals-model";

/** `n` of `of`, or `null` where nothing was measured: never a zero. */
export type Half = { n: number; of: number } | null;

export interface Figures {
  google: Half;
  ai: Half;
}

export interface MarketFigures {
  /** Per competitor; `null` where it joined after the last scan. */
  cards: Readonly<Record<string, Figures | null>>;
  you: Figures;
}

function half(card: PresenceCard, count: number): Half {
  return card.of === 0 ? null : { n: count, of: card.of };
}

function countOf(card: PresenceCard, domain: string): number {
  return card.rivals.find((row) => row.domain === domain)?.count ?? 0;
}

export function marketFigures(p: {
  competitors: readonly string[];
  /** The rivals the last scan measured against; `null` before any scan. */
  measured: readonly string[] | null;
  firstPage: PresenceCard;
  named: PresenceCard;
}): MarketFigures {
  const cards: Record<string, Figures | null> = {};
  for (const domain of p.competitors) {
    cards[domain] =
      p.measured === null || !p.measured.includes(domain)
        ? null
        : { google: half(p.firstPage, countOf(p.firstPage, domain)), ai: half(p.named, countOf(p.named, domain)) };
  }
  return {
    cards,
    you: { google: half(p.firstPage, p.firstPage.you.count), ai: half(p.named, p.named.you.count) },
  };
}
