// SPEC §4, §6, §7 (issue 867) — what this page is for, on the screen the
// founder edits it on.
//
// The owner, 2026-09-17: the customer was never shown what their content is
// optimising for. Every value here was measured by the pass that chose the
// page and copied onto its opportunity at creation: the search, how it is
// asked, its demand, its difficulty against the ceiling this site is judged
// by (§6, issue 858), the band, where the AI engines stood, and what "done"
// means for it.
//
// daisyUI `card` and a definition list in the route (docs/DESIGN.md rule 1):
// no new component, no CSS of its own. The labels are the day panel's own
// keys — one fact, worded once, on both screens.
//
// Every number goes through `renderMeasured`: a difficulty the vendor never
// gave renders the dash and its written line, never a 0, which would read
// as "nothing to beat".
import type React from "react";
import { Target } from "lucide-react";
import { BAND_LABELS } from "@/lib/presentation/bands";
import { copy } from "@/lib/presentation/copy";
import { renderMeasured } from "@/lib/presentation/measured";
import { ENGINE_LABEL, ENGINE_STANDING, formatCount } from "../../_shell/page-target-words";
import type { PageTarget } from "../../_shell/page-target";
import type { DraftTarget } from "./model";

const EYEBROW = "card-title text-xs font-semibold uppercase tracking-wide text-base-content/60";

function Row(p: { label: string; children: React.ReactNode; sentence?: boolean }): React.JSX.Element {
  return (
    <>
      <dt className="opacity-60">{p.label}</dt>
      <dd className={p.sentence === true ? "min-w-0" : "num num-phrase min-w-0"}>{p.children}</dd>
    </>
  );
}

function Card(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border bg-base-100 min-w-0" data-testid="draft-target">
      <div className="card-body min-w-0 gap-3">
        <h2 className={`flex items-center gap-2 ${EYEBROW}`}>
          <Target size={20} strokeWidth={1.75} aria-hidden />
          {copy("draft.target.title")}
        </h2>
        {p.children}
      </div>
    </section>
  );
}

function Facts(p: { target: PageTarget }): React.JSX.Element {
  const { target } = p;
  const volume = renderMeasured(target.volume, {
    format: formatCount,
    unmeasuredLine: "unmeasured.undeterminable",
    what: target.search,
  });
  const difficulty = renderMeasured(target.difficulty, {
    format: (v) => String(v),
    unmeasuredLine: "unmeasured.undeterminable",
    what: target.search,
  });
  // The difficulty beside the bar this site is judged against, where the
  // row carries one: a number alone is not a verdict.
  const difficultyText =
    difficulty.isDash || target.ceiling === null
      ? difficulty.text
      : copy("calendar.why.difficulty.of-ceiling", {
          difficulty: difficulty.text,
          ceiling: String(target.ceiling),
        });

  return (
    <>
      <dl className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <Row label={copy("calendar.why.search")}>{target.search}</Row>
        <Row label={copy("calendar.why.asked")}>{target.askedAs}</Row>
        <Row label={copy("calendar.why.volume")}>{volume.text}</Row>
        <Row label={copy("calendar.why.difficulty")}>{difficultyText}</Row>
        {/* The band through BAND_LABELS (ADR-001) — never a word this
            component writes. */}
        <Row label={copy("calendar.why.band")} sentence>
          <span className="badge badge-ghost">{copy(BAND_LABELS.winnability[target.winnability])}</span>
        </Row>
        {target.engines.length === 0 ? null : (
          <Row label={copy("calendar.why.engines")} sentence>
            <span className="flex flex-wrap gap-1" data-testid="draft-target-engines">
              {target.engines.map((engine) => (
                <span key={engine.engine} className="badge badge-ghost h-auto whitespace-normal py-1 text-left">
                  {copy("calendar.why.engine.line", {
                    engine: copy(ENGINE_LABEL[engine.engine]),
                    standing: copy(ENGINE_STANDING[engine.standing]),
                  })}
                </span>
              ))}
            </span>
          </Row>
        )}
        <Row label={copy("calendar.why.done-when")} sentence>
          {target.doneWhen}
        </Row>
      </dl>
      {/* Each outage's own written line, under the list rather than in it. */}
      {volume.line === undefined ? null : <p className="text-xs opacity-70">{volume.line}</p>}
      {difficulty.line === undefined ? null : <p className="text-xs opacity-70">{difficulty.line}</p>}
    </>
  );
}

/** The block, in each of the three states a draft's target can be in. A Fix
 *  page and an unreadable opportunity each say what is true of them; neither
 *  is drawn as an empty list. */
export function TargetBlock(p: { target: DraftTarget }): React.JSX.Element {
  if (p.target.kind === "target") {
    return (
      <Card>
        <Facts target={p.target.target} />
      </Card>
    );
  }
  return (
    <Card>
      <p className="text-sm opacity-70">
        {copy(p.target.kind === "fix" ? "draft.target.fix" : "draft.target.unknown")}
      </p>
    </Card>
  );
}
