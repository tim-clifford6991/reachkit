"use client";
// The offer line's drawing; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { SpotsLeft } from "@/lib/account/offer/spots";

export type OfferWords = {
  label: string;
  pitch: readonly string[];
  before: string;
  /** Carries `{left}` for the count. */
  left: string;
  taken: string;
  ended: string;
  see: string | null;
};

const SEP = " · ";

export function OfferLineLeaf(p: { read: boolean; spots: SpotsLeft | null; endsAt: number; words: OfferWords }): React.JSX.Element | null {
  const [spots, setSpots] = useState<SpotsLeft | null>(p.spots);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    // Unknown keeps the before line, never 0; after the end it can say neither taken nor ended, so nothing is drawn.
    const settle = (read: SpotsLeft | null): void => (read === null && Date.now() >= p.endsAt ? setGone(true) : setSpots(read));
    if (!p.read) return settle(p.spots);
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<SpotsLeft | { state: "unknown" }>) : null))
      .then((body) => settle(body === null || body.state === "unknown" ? null : (body as SpotsLeft)))
      .catch(() => settle(null));
  }, [p.read, p.spots, p.endsAt]);

  if (gone || spots?.state === "over") return null;
  const w = p.words;
  const closed = spots?.state === "full" ? w.taken : spots?.state === "ended" ? w.ended : null;
  const few = spots?.state === "few";
  const count = spots?.left === undefined ? w.before : w.left.replace("{left}", String(spots.left));
  return (
    // First in the shell's column, above the header; it scrolls away, and its height is held so the read shifts nothing.
    <aside aria-label={w.label} className="bg-base-200 text-base-content order-first min-h-16 px-4 py-2 text-center text-sm lg:min-h-10">
      {closed ?? (
        <>
          {w.pitch.map((part) => (
            <span key={part} className="hidden sm:inline">
              {part}
              {SEP}
            </span>
          ))}
          <span className={few ? "font-semibold" : undefined}>
            {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="mr-1 inline align-text-bottom" />}
            {count}
          </span>
          {w.see !== null && (
            <>
              {SEP}
              <Link href="/pricing" prefetch={false} className="link link-primary inline-flex min-h-6 items-center">
                {w.see}
              </Link>
            </>
          )}
        </>
      )}
    </aside>
  );
}
