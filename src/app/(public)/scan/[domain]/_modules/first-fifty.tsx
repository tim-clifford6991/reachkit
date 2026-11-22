"use client";
// The card's first-50 block; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { Clock } from "lucide-react";
import type { Offer } from "@/lib/account/offer/open";
import { useSpots } from "../../../_chrome/use-spots";

/** Drawn only while the offer is open; with `read`, the page's read of `/offer/spots` replaces the build's answer. */
export function FirstFifty(p: { read: boolean; offer: Offer; block: React.ReactNode; promise: React.ReactNode; before: string }): React.JSX.Element {
  const offer = useSpots(p.read) ?? p.offer;
  const few = offer.state === "few" && offer.count !== null;
  return (
    <>
      {offer.open && p.block}
      {p.promise}
      {offer.open && (
        <p className={`flex items-center gap-1.5 text-sm ${few ? "font-semibold" : ""}`}>
          {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
          {offer.count ?? p.before}
        </p>
      )}
    </>
  );
}
