"use client";
// The phone offer bar at the foot of Pricing and the report; it holds no copy key, so the registry stays out of the public bundle.
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Clock } from "lucide-react";
import { offerOpen, type Offer } from "@/lib/account/offer/open";
import { useSpots } from "../../../_chrome/use-spots";
import { CHECKOUT_QUERY_KEY, refusalIn, type CheckoutRefusal } from "../../../pricing/state";

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

/**
 * Drawn after the footer once the page has loaded, below `md`; `start` is the card's own action in a second form.
 * With `read`, the page's read of `/offer/spots` replaces the build's answer.
 */
export function OfferBar(p: {
  read: boolean;
  offer: Offer;
  words: { before: string; promise: string; refused: Record<CheckoutRefusal, string> };
  /** A refusal's line is drawn in place of the spots line, so it never makes the bar taller; `query` reads it from the address. */
  refused: CheckoutRefusal | null | "query" | undefined;
  start: React.ReactNode;
}): React.JSX.Element {
  const offer = useSpots(p.read) ?? p.offer;
  const [at, setAt] = useState<{ body: HTMLElement; refused: CheckoutRefusal | null } | null>(null);
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refused = p.refused === "query" ? refusalIn(new URLSearchParams(location.search).get(CHECKOUT_QUERY_KEY)) : (p.refused ?? null);
    // Read on each scroll rather than observed: a solid button that hydration or a later step swaps in is counted too.
    let frame = 0;
    const check = (): void => {
      frame = 0;
      const boxes = Array.from(document.querySelectorAll(SOLID), (el) => el.getBoundingClientRect()).filter((box) => box.width > 0);
      // Once the page's own action has scrolled away above, and while no solid button is on screen.
      const passed = boxes.some((box) => box.bottom <= 0);
      const onScreen = boxes.some((box) => box.bottom > 0 && box.top < window.innerHeight);
      setAt((was) => was ?? { body: document.body, refused });
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
  }, [p.refused]);

  // The page's foot reserve is the tallest the bar has been, so it never covers the footer or a focused link.
  // Measured before paint as the bar shows, since the observer reports a frame after the bar already covers the foot.
  useLayoutEffect(() => {
    const el = bar.current;
    if (el === null) return;
    const root = document.documentElement;
    const grow = (): void => {
      const was = Number.parseFloat(root.style.getPropertyValue("--offer-bar-h")) || 0;
      if (el.offsetHeight > was) root.style.setProperty("--offer-bar-h", `${el.offsetHeight}px`);
    };
    grow();
    const sized = new ResizeObserver(grow);
    sized.observe(el);
    return () => sized.disconnect();
  }, [at, shown]);

  // Drawn only once mounted, so the browser's clock decides: from the end date no state makes a first-50 claim.
  const open = offerOpen(offer.state);
  const few = open && offer.state === "few" && offer.count !== null;

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
              <p className="text-error min-w-0 text-sm">{p.words.refused[at.refused]}</p>
            ) : (
              <p className={`flex min-w-0 items-center gap-1.5 text-sm ${few ? "font-semibold" : ""}`}>
                {few && <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
                {open ? (offer.count ?? p.words.before) : p.words.promise}
              </p>
            )}
            {p.start}
          </div>,
          at.body
        )}
    </>
  );
}
