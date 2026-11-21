"use client";
// The card's first-50 block; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { SpotsLeft } from "@/lib/account/offer/spots";

/** Drawn only while the offer is open; with `read`, `/offer/spots` fills the count and closes a state that moved since the build. */
export function FirstFifty(p: {
  read: boolean;
  spots: Pick<SpotsLeft, "state" | "left">;
  block: React.ReactNode;
  promise: React.ReactNode;
  words: { before: string; left: string };
}): React.JSX.Element {
  const [spots, setSpots] = useState(p.spots);
  useEffect(() => {
    if (!p.read) return;
    // A failed or unknown read keeps the build's block, as the offer line keeps its line.
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<SpotsLeft | { state: "unknown" }>) : null))
      .then((body) => body !== null && body.state !== "unknown" && setSpots(body))
      .catch(() => undefined);
  }, [p.read]);

  // Once all are taken or the offer has ended there is no way to claim it, so only the promise stays.
  const open = spots.state === "open" || spots.state === "few";
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
