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

type Arm = { state: "before" | "open" | "few" | "full" | "ended"; left?: number };

const SEP = " · ";
/** Every line the read can bring, drawn unseen in one cell, so the box is the tallest of them at every width. */
const ARMS: readonly Arm[] = [{ state: "before" }, { state: "few", left: 50 }, { state: "full" }, { state: "ended" }];

function Line(p: { arm: Arm; words: OfferWords; urgent: boolean }): React.JSX.Element {
  const w = p.words;
  if (p.arm.state === "full") return <>{w.taken}</>;
  if (p.arm.state === "ended") return <>{w.ended}</>;
  const few = p.urgent && p.arm.state === "few";
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
        {p.arm.left === undefined ? w.before : w.left.replace("{left}", String(p.arm.left))}
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

/** `spots` is the server's read; with `read`, the line stays unseen until `/offer/spots` answers, so no stale wording paints. */
export function OfferLineLeaf(p: { read: boolean; spots: SpotsLeft | null; endsAt: number; words: OfferWords }): React.JSX.Element | null {
  const [spots, setSpots] = useState<SpotsLeft | Arm | null>(p.spots);
  useEffect(() => {
    if (!p.read) return;
    // Unknown is never 0: before the end it is the before line, after it the ended line, true whether full or not.
    const unread = (): void => setSpots({ state: Date.now() >= p.endsAt ? "ended" : "before" });
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<SpotsLeft | { state: "unknown" }>) : null))
      .then((body) => (body === null || body.state === "unknown" ? unread() : setSpots(body as SpotsLeft)))
      .catch(unread);
  }, [p.read, p.endsAt]);

  if (spots?.state === "over") return null;
  // A paid reader in setup cannot act on few-left, so only a selling page draws its style.
  const urgent = p.words.see !== null || p.words.pitch.length > 0;
  return (
    // First in the shell's column, above the header; it scrolls away.
    <aside aria-label={p.words.label} className="bg-base-200 text-base-content order-first grid px-4 py-2 text-center text-sm">
      {ARMS.map((arm) => (
        <div key={arm.state} aria-hidden className="invisible [grid-area:1/1]">
          <Line arm={arm} words={p.words} urgent />
        </div>
      ))}
      <div className="[grid-area:1/1]">{spots !== null && <Line arm={spots as Arm} words={p.words} urgent={urgent} />}</div>
    </aside>
  );
}
