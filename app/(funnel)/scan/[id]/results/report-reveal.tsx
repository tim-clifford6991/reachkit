/**
 * ReportReveal — staggered entrance for the four-question report sections.
 *
 * SERVER component: the sections are server-rendered (in the SSR HTML, visible
 * immediately — important for the report content + SEO). The entrance is a
 * pure-CSS animation (tw-animate-css `animate-in`), gated by `motion-safe` so
 * reduced-motion users get the content with no animation. No client JS, no
 * `ssr:false` — content is never gated behind hydration.
 */

import { Children, isValidElement, type ReactNode } from "react";

interface ReportRevealProps {
  children: ReactNode;
}

export function ReportReveal({ children }: ReportRevealProps) {
  return (
    <div className="space-y-4">
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            key={i}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-500"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
