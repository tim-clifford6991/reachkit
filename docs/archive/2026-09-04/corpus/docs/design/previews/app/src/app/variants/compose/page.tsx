"use client";

/**
 * /variants/compose — the route the owner's actual ask needs.
 *
 * "Give me back a handful of variants that I can choose specific elements
 * from to build our final structure." A preset is somebody else's seven
 * choices. This page is the seven choices, unbundled: set each axis where
 * you want it, watch both whole screens change, and hand back the tuple.
 *
 * The tuple printed at the top is the ONLY thing this page emits, on
 * purpose. Printing the resulting --v-* values here would put a second
 * copy of every value next to the one in variants.css, and a second copy
 * is how they diverge (rule 2.4). The tuple names positions; variants.css
 * is the one home for what a position is worth.
 */
import { useState } from "react";
import Link from "next/link";
import { StateBar } from "@/components/chrome/WalkBanner";
import { Mono, Note, P, Pre, SheetHead, Stop } from "@/components/chrome/sheet";
import {
  AXES,
  BASE,
  PRESETS,
  type AxisId,
  type Tuple,
  heldAxes,
  movedAxes,
  positionOf,
  proposedSpend,
} from "../axes";
import { VariantScope } from "../VariantScope";
import { OVERVIEW_VIEWS, OverviewContent, type OverviewView } from "../screens/OverviewContent";
import { REPORT_VIEWS, ReportContent, type ReportView } from "../screens/ReportContent";

export default function Compose() {
  const [tuple, setTuple] = useState<Tuple>({ ...BASE });
  const [overviewView, setOverviewView] = useState<OverviewView>("measured");
  const [reportView, setReportView] = useState<ReportView>("report");

  const set = (axis: AxisId, pos: string) => setTuple((t) => ({ ...t, [axis]: pos }));
  const moved = movedAxes(tuple);
  const held = heldAxes(tuple);
  const proposed = proposedSpend(tuple);

  const line = AXES.map((a) => `${a.attr}="${tuple[a.id]}"`).join("\n");

  return (
    <main className="pv-wrap">
      <SheetHead
        title="Compose"
        carries="preview artifact · exploration · nothing here is signed"
      >
        <P>
          Seven pickers, both whole screens underneath, and the tuple you have built printed so it
          can be handed back as one block. Start from a preset or from today&rsquo;s values and
          move one axis at a time — the point of the exercise is that you can take the spacing off
          one variant and the radius off another.
        </P>
      </SheetHead>

      <Stop>
        <p style={{ margin: 0, fontWeight: 700 }}>Nothing here is signed.</p>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          Composing a tuple is not a ruling and does not move a{" "}
          <Mono>components.md</Mono> row. What turns one of these into law is your word on the
          positions, and — for the two marked <Mono>proposed</Mono> — your word on the two tokens
          the registry does not hold.
        </p>
      </Stop>

      <h2 className="pv-h2">Start from</h2>
      <div className="pv-toggle" role="group" aria-label="preset">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-current={AXES.every((a) => tuple[a.id] === p.tuple[a.id]) ? "true" : "false"}
            onClick={() => setTuple({ ...p.tuple })}
          >
            {p.id}
          </button>
        ))}
      </div>

      <h2 className="pv-h2">The seven axes</h2>
      <div className="pv-grid pv-grid-2">
        {AXES.map((axis) => (
          <div className="pv-cell" key={axis.id}>
            <div className="pv-cell-head">
              <span className="pv-cell-name">{axis.title}</span>
              <span className="pv-cell-note">{axis.attr}</span>
            </div>
            <div className="pv-cell-body">
              <div className="pv-toggle" role="group" aria-label={axis.title}>
                {axis.positions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    data-current={tuple[axis.id] === pos.id ? "true" : "false"}
                    onClick={() => set(axis.id, pos.id)}
                  >
                    {pos.id}
                    {pos.proposes ? " ·" : ""}
                  </button>
                ))}
              </div>
              <p className="pv-p" style={{ margin: "var(--s-3) 0 0" }}>
                {positionOf(axis.id, tuple[axis.id])?.note}
              </p>
              <p className="pv-p" style={{ margin: "var(--s-2) 0 0", color: "var(--pv-stop)" }}>
                <strong>Costs:</strong> {positionOf(axis.id, tuple[axis.id])?.cost}
              </p>
              {positionOf(axis.id, tuple[axis.id])?.pick ? (
                <p className="pv-p" style={{ margin: "var(--s-2) 0 0" }}>
                  <strong>Design-guardian:</strong> {positionOf(axis.id, tuple[axis.id])?.pick}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <h2 className="pv-h2">What you have built</h2>
      <Pre>{line}</Pre>
      <p className="pv-mono" style={{ margin: "0 0 var(--s-3)" }}>
        moves {moved.length} of 7 · held at today&rsquo;s values:{" "}
        {held.length ? held.map((id) => AXES.find((a) => a.id === id)?.title).join(" · ") : "none"}
      </p>
      {proposed.length > 0 ? (
        <div className="pv-stop">
          <p style={{ margin: 0 }}>
            <strong>This tuple spends {proposed.join(" and ")}.</strong> Neither is registered.
            Under duty 3 a token enters as <Mono>proposed</Mono> with its derivation, gets your
            approval, and only then may be used — so a tuple containing one of these is a design
            plus a token decision, not a design alone.
          </p>
        </div>
      ) : (
        <Note>
          <p style={{ margin: 0 }}>
            <strong>This tuple spends only tokens that already exist.</strong> Every value in it is
            declared in <Mono>globals.css</Mono> today, so nothing in it needs a token ruling — it
            needs a ruling on the positions and nothing else.
          </p>
        </Note>
      )}

      <h2 className="pv-h2">The workspace</h2>
      <P>
        <Link href="/walk/app/overview" className="pv-mono">/walk/app/overview</Link> is the
        baseline this is compared against. Five minutes most evenings, by someone who already
        trusts the product.
      </P>
      <div style={{ marginBottom: "var(--s-3)" }}>
        <StateBar
          states={[...OVERVIEW_VIEWS]}
          value={overviewView}
          onChange={(s) => setOverviewView(s as OverviewView)}
        />
      </div>
      <VariantScope tuple={tuple}>
        <OverviewContent view={overviewView} />
      </VariantScope>

      <h2 className="pv-h2">The public face</h2>
      <P>
        <Link href="/walk/report" className="pv-mono">/walk/report</Link> is the baseline. Seen
        once, by a stranger who owes us nothing — a token set that flatters the workspace can fail
        this one quietly, which is why both are on this page rather than one.
      </P>
      <div style={{ marginBottom: "var(--s-3)" }}>
        <StateBar
          states={[...REPORT_VIEWS]}
          value={reportView}
          onChange={(s) => setReportView(s as ReportView)}
        />
      </div>
      <VariantScope tuple={tuple}>
        <ReportContent view={reportView} />
      </VariantScope>
    </main>
  );
}
