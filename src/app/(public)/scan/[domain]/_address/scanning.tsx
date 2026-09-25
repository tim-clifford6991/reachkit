// BUILD §4.1 — the scanning screen: the stages on the left, the report's
// own sections beside them, each held by a skeleton (#935).
// src/app/(public)/scan/[domain]/_address/scanning.tsx
//
// SPEC §2, **2026-09-20**: "The report fills in as the scan runs (owner,
// #908): named stages with elapsed times still stand on the left (no
// spinner, %, countdown), and each report section appears in place as its
// stage finishes, a daisyUI `skeleton` holding its place until then. **No
// full-page wait.**"
//
// What stood here was one card with the six stages in it and nothing else
// — a reader watched a list and then the whole report arrived at once.
// Now the report's own spine is drawn from the first frame: four named
// sections in §4.1's order, each with its title and a `skeleton` where its
// content will be, and each bound to the one stage that produces it.
//
// **What this does and does not claim.** A section's place is held from
// the first frame and its stage is marked the moment the stream says that
// stage finished — so nothing here is a spinner, a percentage or a
// countdown, and there is no full-page wait. What a section cannot do yet
// is carry its *content* before the pass ends: the engine stores one
// report, once, at the end (`run.ts`'s single `storeCurrentReport`), so
// there is nothing to put in a section's place until then. Inventing one
// would be worse than holding it. The half that is missing is a store,
// not a screen, and this PR's body says so.
//
// **One stream, two readers.** `useScanStages` is subscribed once here and
// its reading is handed to both the steps list and the skeletons; a second
// `EventSource` would be a second answer to "where is this scan". The
// ending event is still `ScanProgress`'s to act on — it refreshes the
// router, the address re-resolves, and the report arm replaces this one.
//
// daisyUI in the route (DESIGN rule 1): `card`, `skeleton`, `steps`,
// `status`. No custom component and no stylesheet.
"use client";

import type React from "react";
import { Surface } from "@/ui/layout";
import { SKELETON_EXIT, ViewTransition } from "@/ui/motion";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { StageName } from "@/lib/scan/stages";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { ScanProgress, useScanStages } from "./progress";
import { Num } from "./measured";

/**
 * The report's spine, in §4.1's order, each section against the one stage
 * that measures it.
 *
 * Four and not six: these are the sections that have both a title of their
 * own in the registry and a stage that produces them. The DIY method and
 * the offer are on every report whatever the scan found — they measure
 * nothing, so no stage finishes them — and the technical-issue cards have
 * no section heading to hold a place under. A skeleton under a heading
 * nobody wrote would be a heading minted here, which is not this file's to
 * do.
 */
const SECTIONS: readonly { readonly title: CopyKey; readonly stage: StageName; readonly lines: number }[] = [
  { title: "verdict.score.label", stage: "scoring", lines: 3 },
  { title: "ai-answers.title", stage: "asking_the_twelve", lines: 4 },
  { title: "presence.title", stage: "checking_your_presence", lines: 4 },
  { title: "free-page.title", stage: "scoring", lines: 3 },
];

/** One section's place: its title, whether its stage has finished, and a
 *  `skeleton` where the content will be. The status dot is never the only
 *  carrier of that fact — the steps list beside it says the same stage
 *  finished, in words, with the time it took. */
function SectionPlace(p: { title: CopyKey; done: boolean; lines: number }): React.JSX.Element {
  return (
    <section className="card bg-base-100 shadow-(--shadow-card)" data-testid="scan-section" data-done={p.done}>
      <div className="card-body gap-3">
        <h3 className="card-title text-base">
          {/* The dot rises in the moment its stage finishes (the calm
              layer's motion, #1059); reduced motion draws it in place. */}
          {p.done ? <span className="status status-success motion-safe:animate-rise" aria-hidden /> : null}
          {copy(p.title)}
        </h3>
        {/* The content's place. `aria-hidden`: it carries no information a
            reader could use, and the stages beside it are the accessible
            account of what is happening. When the report arrives (the
            router's refresh is a transition) the skeleton leaves and the
            page cross-fades to what replaced it (#1065's reveal). */}
        <ViewTransition {...SKELETON_EXIT}>
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: p.lines }, (_unused, line) => (
              <div key={line} className={`skeleton h-4 ${line === p.lines - 1 ? "w-2/3" : "w-full"}`} />
            ))}
          </div>
        </ViewTransition>
      </div>
    </section>
  );
}

export function ScanningView(p: {
  domain: CanonicalDomain;
  /** Present when the address already knew which scan is running. Absent
   *  on the `starting` arm, where the stream's own hook claims one. */
  scanId?: string;
}): React.JSX.Element {
  const stages = useScanStages({ domain: p.domain, scanId: p.scanId });

  return (
    // The same three band arms the report itself declares (ADR-093
    // decision 6): one column on a phone, two from medium up — the stages
    // on the left and the sections filling the right, which is what SPEC
    // §2's "still stand on the left" describes at the widths that have a
    // left.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid items-start gap-4">
        <section className="card bg-base-100 shadow-(--shadow-card)">
          <div className="card-body gap-4">
            {/* The domain is what this report is *about*, so it is the
                page's `<h1>` (owner ruling 2026-09-23, #328). It was an
                `<h2>`, which left `/scan/{domain}` with no level-one
                heading at all. `card-title` carries the size and weight,
                so nothing on screen changes. */}
            <h1 className="card-title min-w-0 overflow-x-auto">
              <Num>{p.domain}</Num>
            </h1>
            {/* The stages read the stream this screen already subscribed
                to, rather than opening a second one. */}
            <ScanProgress domain={p.domain} scanId={p.scanId} stages={stages} />
            {/* REQ-003 c1's own frame, and the set's line: what the wait is
                worth, and that the address survives it. No countdown — the
                stages carry the only figures on this screen. */}
            <p className="text-base-content/70 text-sm">{copy("scan.waiting.line")}</p>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {SECTIONS.map((section) => (
            <SectionPlace
              key={section.title}
              title={section.title}
              lines={section.lines}
              done={stages.done.has(section.stage)}
            />
          ))}
        </div>
      </main>
    </Surface>
  );
}
