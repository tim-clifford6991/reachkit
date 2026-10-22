// SPEC §5 (docs/spec/decisions/2026-10-22-1737.md) — the side of the step.
//
// Site and Check draw *What happens next*: the three steps, which one the
// founder is on, and that nothing is left to do after them. Connect draws
// the customer's own blog in a daisyUI `mockup-browser`: the address as it
// fills in, the business's own name and the market the scan read where it
// read one, and `skeleton` where a fact is not known yet — never a guess.
//
// Below the large breakpoint the panel is not beside anything — it follows
// the question, which is why nothing in here says "on the right".
"use client";

import type React from "react";
import { Check } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PANEL, PANEL_BODY, QUIET } from "./frame";
import { SETUP_STEPS, stepIndex, type SetupStepId } from "./steps";

/** Each step's name and line in the rail, in the order the founder meets them. */
const NEXT_COPY = {
  site: { name: "setup.next.site", line: "setup.next.site.line" },
  check: { name: "setup.next.check", line: "setup.next.check.line" },
  publishing: { name: "setup.next.publishing", line: "setup.next.publishing.line" },
} as const satisfies Record<SetupStepId, { name: CopyKey; line: CopyKey }>;

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
  /** The pass's live status line, already composed by the caller — it holds
   *  the subscription, which is a client concern and not a panel's. */
  status?: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside className={PANEL} data-testid="setup-panel" data-step={p.step}>
      {/* Keyed on the step, so the panel's side of a step change rises in
          one stagger (60ms) after the question's. The status line below
          stays mounted: it holds the pass's subscription. */}
      <div
        key={p.step}
        className={`${PANEL_BODY} motion-safe:animate-rise motion-safe:[animation-delay:60ms]`}
      >
        {p.step === "publishing" ? (
          <>
            <h2 className="min-w-0 text-base font-medium wrap-anywhere" data-testid="setup-panel-title">
              {copy("setup.panel.publishing.title")}
            </h2>
            <BlogMockup address={p.blogAddress} businessName={p.businessName} market={p.market} />
            <p className={QUIET} data-testid="setup-panel-note">
              {copy("setup.panel.note")}
            </p>
          </>
        ) : (
          <NextRail step={p.step} />
        )}
      </div>
      {/* The pass's current step, where one is running. It is the last
          thing in the panel because it is about the work, not about the
          answer the founder is giving. */}
      {p.status}
    </aside>
  );
}

/** The three steps, where the founder is, and that nothing follows them. */
function NextRail(p: { step: SetupStepId }): React.JSX.Element {
  const at = stepIndex(p.step);
  return (
    <section className="card card-border bg-base-100" data-testid="setup-next">
      <div className="card-body gap-4 p-4">
        <h2 className="text-sm font-medium text-base-content/70">{copy("setup.next.title")}</h2>
        <ol className="grid gap-3">
          {SETUP_STEPS.map((id, index) => (
            <li key={id} className="flex min-w-0 gap-3" aria-current={index === at ? "step" : undefined}>
              <span
                className={`badge badge-sm num shrink-0 ${index <= at ? "badge-primary" : "badge-ghost"}`}
              >
                {index < at ? <Check strokeWidth={1.75} size={12} aria-hidden /> : String(index + 1)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 font-medium">
                  {copy(NEXT_COPY[id].name)}
                  {index === at ? (
                    <span className="badge badge-soft badge-primary badge-sm">{copy("setup.next.here")}</span>
                  ) : null}
                </span>
                <span className={QUIET}>{copy(NEXT_COPY[id].line)}</span>
              </span>
            </li>
          ))}
          <li className="flex min-w-0 gap-3">
            <span className="status status-success mt-1.5 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{copy("setup.next.after")}</span>
              <span className={QUIET}>{copy("setup.next.after.line")}</span>
            </span>
          </li>
        </ol>
      </div>
    </section>
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
