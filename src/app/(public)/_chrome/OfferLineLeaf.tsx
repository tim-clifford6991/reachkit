"use client";
// The offer line's drawing; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { Said } from "./offer-sentence";
import { useSpots } from "./use-spots";

export type OfferWords = { label: string; pitch: readonly string[]; see: string | null };

const SEP = " · ";
/** The tallest line's height at each width, so the read changes words and never the box. */
const HELD = "min-h-19 sm:min-h-15 lg:min-h-10";

function Line(p: { said: Said; words: OfferWords; urgent: boolean }): React.JSX.Element {
  const w = p.words;
  if (p.said.mark === "closed") return <>{p.said.text}</>;
  const few = p.urgent && p.said.mark === "few";
  return (
    <>
      {w.pitch.map((part) => (
        <span key={part} className="hidden sm:inline">
          {part}
          {SEP}
        </span>
      ))}
      <span className={few ? "font-semibold" : undefined}>
        {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="mr-1 inline align-text-bottom" />}
        {p.said.text}
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
  );
}

/** `said` is the server's read; with `read`, `/offer/spots` fills the count in the browser and corrects a state that moved since the build. */
export function OfferLineLeaf(p: { read: boolean; said: Said | null; words: OfferWords }): React.JSX.Element | null {
  const spots = useSpots(p.read);
  // A route that did not answer keeps the build's line only while the offer is open at the browser's clock.
  const said = spots === null ? p.said : (spots.line ?? (spots.open ? p.said : null));
  // Never an empty "Offer" region.
  if (said === null) return null;

  // A paid reader in setup cannot act on few-left, so only a selling page draws its style.
  const urgent = p.words.see !== null || p.words.pitch.length > 0;
  return (
    // First in the shell's column, above the header; it scrolls away.
    <aside aria-label={p.words.label} data-nosnippet className={`bg-base-200 text-base-content order-first grid content-center px-4 py-2 text-center text-sm ${HELD}`}>
      <div>
        <Line said={said} words={p.words} urgent={urgent} />
      </div>
    </aside>
  );
}
