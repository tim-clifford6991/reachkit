// SPEC §5 (2026-09-20, #908) — "The right-hand side matches the step."
//
// What this issue draws beside four of the five steps is the customer's own
// blog address in a daisyUI `mockup-browser` with `skeleton` placeholders:
// their blog, before anything has been written into it. The live panels —
// the rivals-by-search grid, the sample paragraph in their own voice — are
// #923, and nothing here pretends to be one: the placeholders say, in a
// line rather than a blank, that the first pages appear once they are
// written.
//
// The business step is the exception, and it is this issue's: step two's
// panel is the profile itself, every item removable, each group with its
// own Add (`BusinessPanel`).
//
// Below the large breakpoint the panel is not beside anything — it follows
// the question, which is why nothing in here says "on the right".
//
// daisyUI classes in the route (DESIGN.md rule 1): `card`, `mockup-browser`,
// `skeleton`. No stylesheet, no wrapper.
"use client";

import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { BusinessPanel } from "./BusinessPanel";
import type { BusinessDraft } from "./business";
import type { SetupStepId } from "./steps";

/** One title per step, in the order the founder meets them. The business
 *  step's is the business's own name where the scan read one. */
const PANEL_TITLE = {
  site: "setup.panel.site.title",
  business: "setup.panel.business.title.unnamed",
  rivals: "setup.panel.rivals.title",
  voice: "setup.panel.voice.title",
  publishing: "setup.panel.publishing.title",
} as const satisfies Record<SetupStepId, CopyKey>;

/** How many placeholder lines stand in for a page that is not written yet.
 *  A count, not a sentence: it says nothing to a reader. */
const PLACEHOLDER_LINES = 3;

export function SetupPanel(p: {
  step: SetupStepId;
  /** The address the hosted blog will serve at, or `null` before the site
   *  address is given. Composed by the caller, which holds the label. */
  blogAddress: string | null;
  businessName: string | null;
  draft: BusinessDraft;
  onDraft: (next: BusinessDraft) => void;
}): React.JSX.Element {
  return (
    <aside className="grid min-w-0 content-start gap-3" data-testid="setup-panel" data-step={p.step}>
      <h2 className="min-w-0 text-base font-medium wrap-anywhere" data-testid="setup-panel-title">
        {p.step === "business" && p.businessName !== null
          ? copy("setup.panel.business.title", { business: p.businessName })
          : copy(PANEL_TITLE[p.step])}
      </h2>

      {p.step === "business" ? (
        <BusinessPanel draft={p.draft} onDraft={p.onDraft} />
      ) : (
        <BlogMockup address={p.blogAddress} />
      )}

      <p className="text-sm text-base-content/70" data-testid="setup-panel-note">
        {copy("setup.panel.note")}
      </p>
    </aside>
  );
}

/** The customer's blog as it stands: an address and nothing in it yet. */
function BlogMockup(p: { address: string | null }): React.JSX.Element {
  return (
    <div
      className="mockup-browser bg-base-100 border border-base-300"
      data-testid="setup-panel-blog"
    >
      <div className="mockup-browser-toolbar">
        {p.address === null ? (
          <span className="min-w-0 truncate text-sm text-base-content/70">
            {copy("setup.panel.address.pending")}
          </span>
        ) : (
          <span
            className="num min-w-0 truncate text-sm"
            data-testid="setup-panel-blog-address"
            title={p.address}
          >
            {p.address}
          </span>
        )}
      </div>
      <div className="grid gap-3 border-t border-base-300 p-4">
        <div className="skeleton h-6 w-2/3" />
        {Array.from({ length: PLACEHOLDER_LINES }, (_, line) => (
          <div key={line} className="skeleton h-4 w-full" />
        ))}
        <p className="text-sm text-base-content/70" data-testid="setup-panel-awaiting">
          {copy("setup.panel.awaiting")}
        </p>
      </div>
    </div>
  );
}
