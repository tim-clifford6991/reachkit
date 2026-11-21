"use client";
// The phone offer bar at the foot of Pricing and the report; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Clock } from "lucide-react";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER } from "../../../pricing/state";

type Read = Pick<SpotsLeft, "state" | "left"> | { state: "unknown"; left?: undefined };

/** The page's solid buttons: the bar is one too, so it shows only once one has scrolled away and while none is on screen. */
const SOLID = "main .btn-primary:not(.btn-soft, .btn-outline, .btn-ghost, .btn-link)";

/** The bar's Start: busy while its checkout opens, at its label's width. */
export function BarStart(p: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary relative min-h-11 shrink-0" disabled={pending} aria-busy={pending || undefined}>
      {/* Transparent, not invisible: the label stays the button's name while it is busy. */}
      <span className={pending ? "opacity-0" : undefined}>{p.label}</span>
      {pending && <span aria-hidden className="loading loading-spinner loading-xs absolute" />}
    </button>
  );
}

/** The bar's one line: from the end date no state, read or not, makes a first-50 claim. */
export function barLine(spots: Read, ended: boolean, words: { before: string; left: string; promise: string }): string {
  const open = !ended && (spots.state === "open" || spots.state === "few" || spots.state === "unknown");
  if (!open) return words.promise;
  return spots.left === undefined ? words.before : words.left.replace("{left}", String(spots.left));
}

/**
 * Drawn after the footer once the page has loaded, below `md`; `start` is the card's own action in a second form.
 * With `read`, `/offer/spots` fills the count a static page was built without.
 */
export function OfferBar(p: {
  read: boolean;
  spots: SpotsLeft | null;
  endsAt: string;
  words: { before: string; left: string; promise: string; refused: string };
  /** A refusal's line is drawn in place of the spots line, so it never makes the bar taller; `query` reads it from the address. */
  refused: boolean | "query" | undefined;
  start: React.ReactNode;
}): React.JSX.Element {
  // A static page drops the count it would keep until the next deploy.
  const [spots, setSpots] = useState<Read>(p.spots === null ? { state: "unknown" } : p.read ? { state: p.spots.state } : p.spots);
  const [at, setAt] = useState<{ body: HTMLElement; ended: boolean; refused: boolean } | null>(null);
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ended = Date.now() >= Date.parse(p.endsAt);
    const refused = p.refused === true || (p.refused === "query" && new URLSearchParams(location.search).get(CHECKOUT_QUERY_KEY) === REFUSED_MARKER);
    // Read on each scroll rather than observed: a solid button that hydration or a later step swaps in is counted too.
    let frame = 0;
    const check = (): void => {
      frame = 0;
      const boxes = Array.from(document.querySelectorAll(SOLID), (el) => el.getBoundingClientRect()).filter((box) => box.width > 0);
      // Once the page's own action has scrolled away above, and while no solid button is on screen.
      const passed = boxes.some((box) => box.bottom <= 0);
      const onScreen = boxes.some((box) => box.bottom > 0 && box.top < window.innerHeight);
      setAt((was) => was ?? { body: document.body, ended, refused });
      setShown(passed && !onScreen);
    };
    const soon = (): void => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };
    soon();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
    };
  }, [p.endsAt, p.refused]);

  // The page's foot reserve is the tallest the bar has been, so it never covers the footer or a focused link.
  useEffect(() => {
    const el = bar.current;
    if (el === null) return;
    const root = document.documentElement;
    const sized = new ResizeObserver(() => {
      const was = Number.parseFloat(root.style.getPropertyValue("--offer-bar-h")) || 0;
      if (el.offsetHeight > was) root.style.setProperty("--offer-bar-h", `${el.offsetHeight}px`);
    });
    sized.observe(el);
    return () => sized.disconnect();
  }, [at]);

  useEffect(() => {
    if (!p.read) return;
    fetch("/offer/spots")
      .then((r) => (r.ok ? (r.json() as Promise<Read>) : null))
      .then((body) => body !== null && setSpots(body))
      .catch(() => undefined);
  }, [p.read]);

  const ended = at?.ended !== false;
  const few = !ended && spots.state === "few" && spots.left !== undefined;

  return (
    <>
      {/* The page reserves the bar's height from this marker, before any script runs; the bar then sets it to its own. */}
      <span data-offer-bar hidden />
      {at !== null &&
        createPortal(
          // Not a landmark: the offer line above the header is the page's one "Offer".
          <div
            ref={bar}
            data-nosnippet
            data-testid="offer-bar"
            className={`bg-base-100 border-base-300 fixed inset-x-0 bottom-0 z-20 items-center justify-between gap-3 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden ${shown ? "flex" : "hidden"}`}
          >
            {at.refused ? (
              <p className="text-error min-w-0 text-sm">{p.words.refused}</p>
            ) : (
              <p className={`flex min-w-0 items-center gap-1.5 text-sm ${few ? "font-semibold" : ""}`}>
                {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
                {barLine(spots, ended, p.words)}
              </p>
            )}
            {p.start}
          </div>,
          at.body
        )}
    </>
  );
}
