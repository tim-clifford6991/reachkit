"use client";

/**
 * HeroSplitReveal — §20.3 set piece 1
 *
 * GSAP SplitText word/char stagger on the marketing hero headline.
 *
 * Strategy:
 * - The headline is in the SSR HTML at all times (SEO, no layout shift)
 * - CSS entrance plays immediately (no JS dependency)
 * - GSAP enhances on hydrate: splits the text, resets CSS animation,
 *   then runs the word stagger. Char stagger on the accent span.
 * - prefers-reduced-motion → skips GSAP entirely, CSS fallback stays
 * - SplitText is part of GSAP 3.x Club (SplitText replaced with manual
 *   word-split approach using spans, no club license needed)
 *
 * Usage: wrap the headline h1 element ref with this hook.
 */

import { useRef } from "react";
import { useGsap } from "./use-gsap-ref";

interface HeroSplitRevealProps {
  /** The headline element to animate (querySelector selector from container) */
  headlineSelector: string;
  /** Accent span selector within the headline */
  accentSelector?: string;
}

export function useHeroSplitReveal({
  headlineSelector,
  accentSelector,
}: HeroSplitRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGsap(
    ({ gsap }) => {
      const container = containerRef.current;
      if (!container) return;

      const headline = container.querySelector<HTMLElement>(headlineSelector);
      if (!headline) return;

      // Split headline text into word spans (manual split — no GSAP Club required)
      function splitWords(el: HTMLElement): HTMLSpanElement[] {
        const originalHTML = el.innerHTML;
        // Preserve inner HTML structure (accent span etc) by working at the
        // childNode level: split text nodes only, leave element children intact
        const spans: HTMLSpanElement[] = [];

        function splitTextNode(node: Text, parent: HTMLElement) {
          const words = node.textContent?.split(/(\s+)/) ?? [];
          const fragment = document.createDocumentFragment();
          for (const word of words) {
            if (/^\s+$/.test(word)) {
              fragment.appendChild(document.createTextNode(word));
            } else {
              const span = document.createElement("span");
              span.textContent = word;
              span.style.display = "inline-block";
              span.style.overflow = "hidden";
              fragment.appendChild(span);
              spans.push(span);
            }
          }
          parent.replaceChild(fragment, node);
        }

        // Walk immediate children
        const childNodes = Array.from(el.childNodes);
        for (const node of childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            splitTextNode(node as Text, el);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recurse into element nodes (the accent <span>)
            const childEl = node as HTMLElement;
            const childTextNodes = Array.from(childEl.childNodes).filter(
              (n) => n.nodeType === Node.TEXT_NODE,
            );
            for (const cn of childTextNodes) {
              splitTextNode(cn as Text, childEl);
            }
          }
        }

        // Cleanup function to restore original HTML
        (el as HTMLElement & { _originalHTML?: string })._originalHTML =
          originalHTML;

        return spans;
      }

      // Cancel any CSS animation on the container so GSAP takes over
      const heroContent =
        container.closest<HTMLElement>(".hero-content") ??
        container.querySelector<HTMLElement>(".hero-content");
      if (heroContent) {
        heroContent.style.animation = "none";
        heroContent.style.opacity = "1";
        heroContent.style.transform = "none";
      }

      // Set initial state for headline
      gsap.set(headline, { opacity: 0, y: 20 });

      // Animate headline container in
      gsap.to(headline, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
        delay: 0.1,
      });

      // Split and stagger words
      const wordSpans = splitWords(headline);
      gsap.set(wordSpans, { opacity: 0, y: 24 });
      gsap.to(wordSpans, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.05,
        delay: 0.2,
      });

      // Accent span: slight scale pop
      if (accentSelector) {
        const accent = container.querySelector<HTMLElement>(accentSelector);
        if (accent) {
          gsap.fromTo(
            accent,
            { filter: "blur(4px)", opacity: 0.4 },
            {
              filter: "blur(0px)",
              opacity: 1,
              duration: 0.7,
              ease: "power2.out",
              delay: 0.5,
            },
          );
        }
      }

      // Animate subhead in after headline
      const subhead = container.querySelector<HTMLElement>("[data-hero-subhead]");
      if (subhead) {
        gsap.fromTo(
          subhead,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.65 },
        );
      }

      // Cleanup: restore original HTML to avoid DOM mutation after unmount
      return () => {
        const el = container.querySelector<
          HTMLElement & { _originalHTML?: string }
        >(headlineSelector);
        if (el?._originalHTML) {
          el.innerHTML = el._originalHTML;
        }
      };
    },
    [],
  );

  return containerRef;
}
