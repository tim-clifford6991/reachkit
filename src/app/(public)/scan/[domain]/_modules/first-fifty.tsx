"use client";
// The card's first-50 block; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { SpotsLeft } from "@/lib/account/offer/spots";

type Shown = Pick<SpotsLeft, "left"> & { state: SpotsLeft["state"] | "before" };

/** Unknown is never 0: before the end it is the before line, after it no offer is drawn. */
const unread = (endsAt: number): Shown => ({ state: Date.now() >= endsAt ? "ended" : "before" });

/** `read` asks `/offer/spots` after paint; else `spots` is the server's read, `null` where it failed. */
export function FirstFifty(p: {
  read: boolean;
  spots: SpotsLeft | null;
  endsAt: number;
  block: React.ReactNode;
  promise: React.ReactNode;
  words: { before: string; left: string };
}): React.JSX.Element {
  const [spots, setSpots] = useState<Shown>(() => (p.read ? { state: "before" } : (p.spots ?? unread(p.endsAt))));
  useEffect(() => {
    if (!p.read) return;
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<SpotsLeft | { state: "unknown" }>) : null))
      .then((body) => setSpots(body === null || body.state === "unknown" ? unread(p.endsAt) : body))
      .catch(() => setSpots(unread(p.endsAt)));
  }, [p.read, p.endsAt]);

  // Once all are taken or the offer has ended there is no way to claim it, so only the promise stays.
  const open = spots.state === "before" || spots.state === "open" || spots.state === "few";
  const few = spots.state === "few";
  return (
    <>
      {open && p.block}
      {p.promise}
      {open && (
        <p className={`flex items-center gap-1.5 text-sm ${few ? "font-semibold" : ""}`}>
          {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
          {spots.left === undefined ? p.words.before : p.words.left.replace("{left}", String(spots.left))}
        </p>
      )}
    </>
  );
}
