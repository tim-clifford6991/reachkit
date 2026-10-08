// SPEC §5 (2026-09-20, #908) — "The right-hand side matches the step."
//
// Three of the five steps draw the customer's own blog in a daisyUI
// `mockup-browser`: the address as it fills in, the business's own name and
// the market the scan read where it read one, and `skeleton` where a fact
// is not known yet. The rivals step draws the searches measured against the
// customer and each rival (#923, `RivalsPanel`); the voice step draws one
// sample paragraph in their own voice (#923, `VoicePanel`).
//
// **A panel never shows a placeholder for a fact we have not got.** Where a
// name, a market or a grid is missing, the panel says so in a line — or
// shows a shape that claims nothing — and never a guess. That is the
// owner's bar for setup: a panel shows what is already known the moment it
// is known, and nothing else.
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
import { RivalsPanel } from "./RivalsPanel";
import { VoicePanel } from "./VoicePanel";
import { PANEL, PANEL_BODY, QUIET } from "./frame";
import type { BusinessDraft } from "./_setup/business";
import type { FounderAnswers } from "@/lib/site-profile/knowledge/types";
import type { RivalGrid } from "./_setup/panel-rivals";
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
  /** The market the scan read, where it read one (#923). `null` is not a
   *  market of "unknown": it is a fact the panel does not state. */
  market: string | null;
  /** #923's rivals grid, or `null` where nothing has been measured for this
   *  address yet. */
  rivalGrid: RivalGrid | null;
  /** The pass's live status line, already composed by the caller — it holds
   *  the subscription, which is a client concern and not a panel's. */
  status?: React.ReactNode;
  draft: BusinessDraft;
  onDraft: (next: BusinessDraft) => void;
  job: string;
  onJob: (next: string) => void;
  answers: FounderAnswers;
  onAnswers: (next: FounderAnswers) => void;
}): React.JSX.Element {
  return (
    // A flex column whose body grows (the calm layer's rhythm, #1091): the
    // aside is stretched to the step's height by the row it sits in, and
    // the body takes what the title and the notes leave, so the preview
    // stands exactly as tall as the step beside it rather than stopping
    // short of it. Below `lg` there is nothing beside it and it is only as
    // tall as it is.
    <aside className={PANEL} data-testid="setup-panel" data-step={p.step}>
      {/* Keyed on the step, so the panel's side of a step change rises in
          one stagger (60ms) after the question's. The status line below
          stays mounted: it holds the pass's subscription. */}
      <div
        key={p.step}
        className={`${PANEL_BODY} motion-safe:animate-rise motion-safe:[animation-delay:60ms]`}
      >
        <h2 className="min-w-0 text-base font-medium wrap-anywhere" data-testid="setup-panel-title">
          {p.step === "business" && p.businessName !== null
            ? copy("setup.panel.business.title", { business: p.businessName })
            : copy(PANEL_TITLE[p.step])}
        </h2>

        {p.step === "business" ? (
          <BusinessPanel
            draft={p.draft}
            onDraft={p.onDraft}
            job={p.job}
            onJob={p.onJob}
            answers={p.answers}
            onAnswers={p.onAnswers}
          />
        ) : p.step === "rivals" ? (
          <RivalsPanel grid={p.rivalGrid} />
        ) : p.step === "voice" ? (
          <VoicePanel />
        ) : (
          <BlogMockup address={p.blogAddress} businessName={p.businessName} market={p.market} />
        )}
      </div>

      <p className={QUIET} data-testid="setup-panel-note">
        {copy("setup.panel.note")}
      </p>
      {/* The pass's current step, where one is running. It is the last
          thing in the panel because it is about the work, not about the
          answer the founder is giving. */}
      {p.status}
    </aside>
  );
}

/**
 * The customer's blog as it stands.
 *
 * The address fills in as they give it and choose their label; the
 * business's own name and the market the scan read stand where the first
 * page's title and its lead will be. A fact the scan did not read is a
 * `skeleton` — a shape that claims nothing — never a placeholder sentence
 * standing in for it.
 */
function BlogMockup(p: {
  address: string | null;
  businessName: string | null;
  market: string | null;
}): React.JSX.Element {
  return (
    <div
      className="mockup-browser grow bg-base-100 border border-base-300"
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
      <div className="grid min-w-0 grid-cols-1 gap-3 border-t border-base-300 p-4">
        {p.businessName === null ? (
          <div className="skeleton h-6 w-2/3" />
        ) : (
          <p
            className="min-w-0 text-base font-bold wrap-anywhere"
            data-testid="setup-panel-blog-name"
          >
            {p.businessName}
          </p>
        )}
        {p.market === null ? (
          <div className="skeleton h-4 w-1/2" />
        ) : (
          <p className="min-w-0 text-sm text-base-content/70" data-testid="setup-panel-blog-market">
            {copy("setup.panel.blog.market", { market: p.market })}
          </p>
        )}
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
