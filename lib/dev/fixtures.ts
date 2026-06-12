import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";

export function useFixtures(): boolean {
  return env.useFixtures;
}

// Realistic canned data so the funnel is demoable without keys.
export function fixtureSerp(productName: string): { competitors: Competitor[]; serpResultCount: number; raw: unknown } {
  return {
    competitors: [
      { name: `${productName} alternative — Habitify`, url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: `${productName} vs Streaks`, url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    serpResultCount: 842000,
    raw: { fixture: true },
  };
}

export function fixtureTavily(productName: string): { competitors: Competitor[]; raw: unknown } {
  return {
    competitors: [{ name: `Top ${productName} alternatives`, url: "https://www.notion.so", source: "tavily", rank: 1 }],
    raw: { fixture: true },
  };
}

export function fixturePh(_productName: string): { selfUpvotes: number; neighbours: Competitor[]; raw: unknown } {
  return {
    selfUpvotes: 312,
    neighbours: [{ name: "Habitify", url: "https://habitify.me", source: "product_hunt", rank: 1 }],
    raw: { fixture: true },
  };
}
