"use client";
// The page's one read of `/offer/spots`: the offer line, the first-50 card and the phone bar share it.
import { useEffect, useState } from "react";
import { offerOpen, type Offer } from "@/lib/account/offer/open";
import type { Said } from "./offer-sentence";

/** The route's answer: `line` is the offer line's sentence, the rest the card's and the bar's. */
export type Spots = Offer & { line: Said | null };

/** A route that did not answer reads as unknown; the line keeps the one it was built with. */
const UNREAD: Spots = { state: "unknown", open: true, count: null, line: null };

let asked: { path: string; spots: Promise<Spots> } | null = null;

/** `null` until the read is in; without `read` (a per-request page) none is made. */
export function useSpots(read: boolean): Spots | null {
  const [spots, setSpots] = useState<Spots | null>(null);
  useEffect(() => {
    if (!read) return;
    const path = location.pathname;
    const ask = asked?.path === path ? asked : { path, spots: fetch("/offer/spots").then((r) => (r.ok ? (r.json() as Promise<Spots>) : UNREAD)).catch(() => UNREAD) };
    asked = ask;
    let live = true;
    // Decided in the browser at its own clock: a page built before the end date closes once it has passed.
    void ask.spots.then((s) => live && setSpots({ ...s, open: offerOpen(s.state) }));
    return () => {
      live = false;
    };
  }, [read]);
  return spots;
}
