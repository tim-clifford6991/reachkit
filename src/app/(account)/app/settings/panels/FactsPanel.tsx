// SPEC §7 (2026-09-20, #908) · issue #926 — the facts ReachKit may quote.
//
// #926: "Facts we can quote: the grounding passages
// (`src/lib/generate/pipeline/grounding.ts`) with source page and how many
// pages used each; a fact can be switched off."
//
// **Every passage on this card is the customer's own sentence.** The
// grounding read takes them off their measured pages word for word — §7's
// standing rule, "only passages read from the customer's own site, word for
// word and linked" — so the card's job is to show each one, say where it
// came from, and let them refuse it. Nothing here is generated and nothing
// is paraphrased.
//
// daisyUI in the route: `card`, `list`, `list-row`, `badge`, `btn`, `link`.
// No library added.
//
// **A passage is prose, so it wraps; it is never a scroller.** A quoted
// sentence can run to a paragraph, and the one thing that must not happen to
// it is being cut off or hidden inside a pane a phone cannot reach into
// (`docs/DESIGN.md`'s no-overflow rule, and #947's keyboard rule for any
// pane that does scroll). So the passage is a block that folds, the page
// link under it folds at its own boundaries, and the row's control sits
// below both at 390 rather than beside them.
//
// **The address is mono and breaks anywhere** (`docs/DESIGN.md`, 2026-10-15,
// issue 1456): `font-mono break-all`, never `.num`, whose `nowrap` pushed a
// long address past the card and scrolled the whole page sideways at 390.
"use client";

import type React from "react";
import { Quote } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { QuotableFact } from "@/lib/site-profile/business/types";
import {
  switchFactOffAction,
  switchFactOnAction,
} from "../business-actions";
import {
  BUSINESS_FACT_FIELD,
} from "../panel-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";

/** How many of the site's pages carry this passage. Two keys, because the
 *  unit is a word with a plural: "1 pages" is not a sentence the product
 *  says, and a count slot cannot fix that by itself. */
function pagesLine(pages: number): string {
  return pages === 1
    ? copy("settings.business.facts.one-page")
    : copy("settings.business.facts.pages", { count: String(pages) });
}

/** The page an address belongs to, as a reader reads it: the path, or the
 *  host where the path is the root. Not a second copy of the URL — the
 *  address itself is the link's text; this is only what a long one is cut
 *  to when it has to be. */
function shortAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.host : parsed.pathname;
  } catch {
    return url;
  }
}

function Fact(p: {
  fact: QuotableFact;
  writer: ReturnType<typeof useSetting>;
}): React.JSX.Element {
  const { fact, writer } = p;
  const action = fact.on ? switchFactOffAction : switchFactOnAction;

  return (
    <li
      className="list-row min-w-0 flex-wrap items-start gap-2"
      data-testid="business-fact"
      data-fact-on={fact.on ? "yes" : "no"}
    >
      <div className="flex min-w-0 grow flex-col gap-1">
        <p className={`min-w-0 wrap-anywhere ${fact.on ? "" : "text-base-content/70 line-through"}`}>
          {fact.passage}
        </p>
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <a
            className="link link-hover min-w-0 font-mono break-all"
            href={fact.url}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddress(fact.url)}
          </a>
          <span className="text-base-content/70">{pagesLine(fact.pages)}</span>
          {fact.on ? null : (
            <span className="badge badge-ghost badge-sm">
              {copy("settings.business.facts.off")}
            </span>
          )}
        </span>
      </div>
      {/* **Its own line on a phone, beside the passage above it.** At 390
          the passage takes the row's width and this control was left about
          one character wide, so *Don't quote this* came out as a column of
          single letters — a defect no check reports, because nothing
          overflowed and nothing was clipped: the text simply wrapped at
          every letter. Found by looking at this screen's own 390 render.
          `w-full` below the small breakpoint puts the control under the
          passage, which is where a phone wants it anyway; `sm:w-auto`
          returns it to the end of the row where there is room. */}
      <form
        action={(form) => writer.press(action, form)}
        className="w-full shrink-0 sm:w-auto"
      >
        <input type="hidden" name={BUSINESS_FACT_FIELD} value={fact.passage} />
        <button
          type="submit"
          className="btn btn-soft btn-primary btn-xs w-full whitespace-nowrap sm:w-auto"
          disabled={writer.busy}
        >
          {writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
          {copy(
            fact.on ? "settings.business.facts.switch-off" : "settings.business.facts.switch-on"
          )}
        </button>
      </form>
    </li>
  );
}

export function FactsPanel(p: { facts: readonly QuotableFact[] }): React.JSX.Element {
  const writer = useSetting();

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-business-facts">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="card-title min-w-0 flex-wrap text-base">
            <Quote size={20} strokeWidth={1.75} aria-hidden />
            {copy("settings.business.facts.title")}
          </h2>
          {writer.saved ? (
            <span className={SAVED_BADGE_CLASS}>{copy("settings.answer.saved-badge")}</span>
          ) : null}
        </div>
        <p className="text-sm text-base-content/70 wrap-anywhere">
          {copy("settings.business.facts.lead")}
        </p>

        {p.facts.length === 0 ? (
          <p className="text-sm wrap-anywhere" data-testid="business-facts-none">
            {copy("settings.business.facts.none")}
          </p>
        ) : (
          <ul className="list bg-base-100 min-w-0 rounded-box">
            {p.facts.map((fact) => (
              <Fact key={fact.passage} fact={fact} writer={writer} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
