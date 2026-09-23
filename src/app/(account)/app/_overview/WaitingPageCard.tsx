// SPEC §4 (2026-09-20, #908) — the page waiting for review.
//
// "the page waiting for review with a one-sentence reason, a small view of
// it as readers will see it, *Read it* and *Stop this page*."
//
// In that order: the stage word and when it goes live, the title, why this
// page — one sentence, built from the target the pass stored — the chips
// that say what kind of page it is and what its chances are, the two
// controls, and beside them the page itself as a reader will meet it.
//
// **The screen's one solid button is *Read it*** (docs/DESIGN.md rule 1:
// one solid primary per screen). Stop is the warning outline: one of the two
// is the thing to do and the other is the thing to do instead, and a screen
// with two solid buttons has said neither.
//
// **It writes no sentence.** The reason's arm is `waiting.ts`'s; the numbers
// go through `renderValue`, so a demand nobody read renders its own arm and
// never a zero; the words are the registry's.
//
// **It cannot overflow.** The two columns stack below `lg`; the title and
// the preview's own title are clamped to two lines and the address to one
// (docs/DESIGN.md: a label that can grow is clamped, a number never is); the
// lead is already cut to length by `lead.ts`.
import type React from "react";
import { BookOpen, Globe } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { BADGE } from "./badges";
import { renderValue } from "./present";
import { StopThisPage } from "./StopThisPage";
import type { WaitingPage, WaitingReason } from "./waiting";

const TEST_ID = "overview-waiting";
const READ_ACTION = "overview.alert.pending-veto.action" satisfies CopyKey;

/** The one sentence, with its numbers already rendered. `renderValue` is the
 *  one path from a `Measured` to a string on this screen; a demand that was
 *  never read reaches the `search` arm before this function, so no dash is
 *  ever interpolated into a sentence about a number. */
function whyLine(reason: WaitingReason): string | null {
  switch (reason.key) {
    case "overview.waiting.why.fix":
      return writtenLine(reason.key);
    case "overview.waiting.why.search":
      return writtenLine(reason.key, { search: reason.search });
    case "overview.waiting.why.not-high-enough":
      return writtenLine(reason.key, {
        search: reason.search,
        volume: renderValue(reason.volume, "overview.tile.searches.label").text,
      });
    default:
      return writtenLine(reason.key, {
        search: reason.search,
        rival: reason.rival,
        volume: renderValue(reason.volume, "overview.tile.searches.label").text,
      });
  }
}

/** The page as a reader meets it: the address it will stand at, its title,
 *  and the lines it opens with. A daisyUI `mockup-browser`, which is what
 *  that component is for — no wrapper and no stylesheet of our own. */
function ReadersView(p: { page: WaitingPage }): React.JSX.Element {
  return (
    <figure
      className="m-0 flex min-w-0 flex-col gap-2"
      aria-label={copy("overview.waiting.preview.label")}
      data-testid="overview-waiting-preview"
    >
      {/* `w-full`: the frame is sized by its container, not by what is
          inside it. `min-w-0` lets it shrink but nothing made it stop
          growing, so with text at 200% it stood 517px wide in a 329px
          column and hung over both edges of the card (WCAG 1.4.4 Resize
          text, #328). At the default step it already measured exactly its
          container, so nothing anyone sees today moves. */}
      <div className="mockup-browser w-full min-w-0 border border-base-300 bg-base-200">
        <div className="mockup-browser-toolbar">
          {p.page.readerHost === null ? null : (
            <span className="num flex min-w-0 items-center gap-2 truncate text-xs">
              <Globe size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              {p.page.readerHost}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 bg-base-100 px-4 py-5">
          <p className="line-clamp-2 text-base font-bold leading-tight">{p.page.title}</p>
          {p.page.lead === "" ? null : (
            <p className="text-sm text-base-content/70">{p.page.lead}</p>
          )}
        </div>
      </div>
      <figcaption className="text-xs font-semibold text-base-content/60">
        {copy("overview.waiting.preview.label")}
      </figcaption>
    </figure>
  );
}

export function WaitingPageCard(p: { page: WaitingPage; timeZone: string }): React.JSX.Element {
  const { page } = p;
  const when =
    page.goesLiveAt === null
      ? writtenLine("overview.waiting.waits")
      : writtenLine("overview.waiting.goes-live", {
          at: formatDateTime(page.goesLiveAt, p.timeZone),
        });
  const why = whyLine(page.reason);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={TEST_ID}>
      <div className="card-body gap-4 p-5">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={BADGE.warn}>{copy(page.stageKey)}</span>
              {when === null ? null : (
                <span className="text-sm text-base-content/70" data-testid="overview-waiting-when">
                  {when}
                </span>
              )}
            </div>

            {/* No size utility: daisyUI's own `card-title` step is what a
                card head is, and since #941 put the heading scale in
                `@layer base` that is what this draws at — 18px, where the
                unlayered `h2` rule used to force 25. */}
            <h2 className="card-title line-clamp-2 leading-tight">{page.title}</h2>

            {why === null ? null : (
              <p className="text-sm" data-testid="overview-waiting-why">
                <span className="font-semibold">{copy("overview.waiting.why.label")} </span>
                {why}
              </p>
            )}

            <div className="flex min-w-0 flex-wrap gap-2">
              {page.badges.map((badgeKey) => (
                <span key={badgeKey} className={BADGE.neutral}>
                  {copy(badgeKey)}
                </span>
              ))}
            </div>

            <div className="flex min-w-0 flex-wrap items-start gap-3">
              <a className="btn btn-primary" href={page.href} data-testid="overview-waiting-read">
                <BookOpen size={20} strokeWidth={1.75} aria-hidden />
                {copy(READ_ACTION)}
              </a>
              <StopThisPage draftId={page.draftId} />
            </div>
          </div>

          <ReadersView page={page} />
        </div>
      </div>
    </section>
  );
}
