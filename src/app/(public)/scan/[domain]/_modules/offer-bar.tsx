"use client";
// The phone offer bar at the foot of Pricing and the report; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Clock } from "lucide-react";
import type { SpotsLeft } from "@/lib/account/offer/spots";

type Read = Pick<SpotsLeft, "state" | "left"> | { state: "unknown"; left?: undefined };

/** The page's solid buttons: the bar is one too, so it shows only while none of them is on screen. */
const SOLID = "main .btn-primary:not(.btn-soft, .btn-outline, .btn-ghost, .btn-link)";

/** The bar's Start: busy while its checkout opens, at its label's width. */
export function BarStart(p: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary relative min-h-11 shrink-0" disabled={pending} aria-busy={pending || undefined}>
      <span className={pending ? "invisible" : undefined}>{p.label}</span>
      {pending && <span aria-hidden className="loading loading-spinner loading-xs absolute" />}
    </button>
  );
}

/**
 * Drawn after the footer once the page has loaded, below `md`; `start` is the card's own action in a second form.
 * With `read`, `/offer/spots` fills the count a static page was built without.
 */
export function OfferBar(p: {
  read: boolean;
  spots: SpotsLeft | null;
  endsAt: string;
  words: { label: string; before: string; left: string; promise: string };
  refused: React.ReactNode;
  start: React.ReactNode;
}): React.JSX.Element {
  // A static page drops the count it would keep until the next deploy.
  const [spots, setSpots] = useState<Read>(p.spots === null ? { state: "unknown" } : p.read ? { state: p.spots.state } : p.spots);
  const [at, setAt] = useState<{ body: HTMLElement; ended: boolean } | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const ended = Date.now() >= Date.parse(p.endsAt);
    const onScreen = new Set<Element>();
    // The first answer comes once the page is laid out; only then is the bar drawn.
    const seen = new IntersectionObserver((entries) => {
      setAt((was) => was ?? { body: document.body, ended });
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      setShown(onScreen.size === 0);
    });
    document.querySelectorAll(SOLID).forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, [p.endsAt]);

  useEffect(() => {
    if (!p.read) return;
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<Read>) : null))
      .then((body) => body !== null && setSpots(body))
      .catch(() => undefined);
  }, [p.read]);

  // A count not read is never a claim after the end; all taken or ended leaves only the promise.
  const open = spots.state === "open" || spots.state === "few" || (spots.state === "unknown" && at?.ended === false);
  const few = spots.state === "few" && spots.left !== undefined;
  const text = !open ? p.words.promise : spots.left === undefined ? p.words.before : p.words.left.replace("{left}", String(spots.left));

  return (
    <>
      {/* The page reserves the bar's height from this marker, before any script runs. */}
      <span data-offer-bar hidden />
      {at !== null &&
        createPortal(
          <aside
            aria-label={p.words.label}
            data-nosnippet
            className={`bg-base-100 border-base-300 fixed inset-x-0 bottom-0 z-20 flex-col gap-2 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden ${shown ? "flex" : "hidden"}`}
          >
            {p.refused}
            <div className="flex items-center justify-between gap-3">
              <p className={`flex min-w-0 items-center gap-1.5 text-sm ${few ? "font-semibold" : ""}`}>
                {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
                {text}
              </p>
              {p.start}
            </div>
          </aside>,
          at.body
        )}
    </>
  );
}
