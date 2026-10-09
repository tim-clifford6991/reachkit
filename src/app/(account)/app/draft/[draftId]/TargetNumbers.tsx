// SPEC §7 (2026-10-09, issue 1364) — the page screen opens with the page's
// numbers: how many people search for what it is written for, and how hard
// that search is against the limit this site is judged by.
//
// Both were measured by the pass that chose the page and are the two the
// closed note *What this page is for* states further down
// (`targetReadings`, one reading for both). A number nobody could read is
// its written line, never a zero (REQ-004). A Fix page and a page whose
// target could not be read have no measures, so the row is not drawn.
//
// daisyUI `card` cells, two to a row at every width; no class of their own.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { targetReadings } from "../../calendar/TargetRows";
import type { DraftTarget } from "./model";

function Tile(p: {
  label: string;
  testId: string;
  /** `null` where the reading was not taken. */
  figure: string | null;
  against?: string | null;
  line: string | undefined;
}): React.JSX.Element {
  return (
    <div className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="card-body gap-2 p-4">
        <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-base-content/70">
          {p.label}
        </span>
        {p.figure === null ? (
          <p className="text-sm text-base-content/70">{p.line ?? p.label}</p>
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="figure text-3xl leading-none">{p.figure}</span>
            {p.against == null ? null : (
              <span className="num num-phrase min-w-0 text-sm text-base-content/70">{p.against}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TargetNumbers(p: { target: DraftTarget }): React.JSX.Element | null {
  if (p.target.kind !== "target") return null;
  const facts = p.target.target;
  const { volume, difficulty } = targetReadings(facts);
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3" data-testid="draft-numbers">
      <Tile
        label={copy("draft.numbers.volume.label")}
        testId="draft-number-volume"
        figure={volume.isDash ? null : volume.text}
        line={volume.line}
      />
      <Tile
        label={copy("calendar.why.difficulty")}
        testId="draft-number-difficulty"
        figure={difficulty.isDash ? null : difficulty.text}
        against={
          facts.ceiling === null ? null : copy("draft.numbers.difficulty.limit", { ceiling: String(facts.ceiling) })
        }
        line={difficulty.line}
      />
    </div>
  );
}
