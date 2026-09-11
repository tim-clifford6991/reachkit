"use client";

/**
 * /variants — the comparison route.
 *
 * This is the deliverable, not the five full screens. A set of variants
 * that each differ on ten things at once cannot be composed from: there is
 * no way to say "that spacing, this radius, those borders". So this page
 * shows ONE AXIS AT A TIME, every position on it, with everything else
 * held at the baseline — and a preset is only a bookmark for seven
 * positions someone already chose.
 */
import { useState } from "react";
import Link from "next/link";
import { Mono, Note, P, ScrollX, SheetHead, Stop } from "@/components/chrome/sheet";
import { AXES, AXIS_IDS, BASE, PRESETS, type AxisId, type Tuple, movedAxes, positionOf, proposedSpend } from "./axes";
import { Specimen } from "./specimens";
import { VariantScope } from "./VariantScope";

export default function VariantsIndex() {
  const [only, setOnly] = useState<AxisId | "all">("all");
  const shown = only === "all" ? AXES : AXES.filter((a) => a.id === only);

  return (
    <main className="pv-wrap">
      <SheetHead
        title="Variants — seven axes, five presets"
        carries="preview artifact · exploration · nothing here is signed"
      >
        <P>
          The same two screens the walkthroughs draw —{" "}
          <Link href="/walk/app/overview" className="pv-mono">/walk/app/overview</Link> and{" "}
          <Link href="/walk/report" className="pv-mono">/walk/report</Link> — rendered through
          different token sets. Both walkthroughs are untouched: they are the baseline, and a
          baseline that moved with the exploration would be no baseline.
        </P>
      </SheetHead>

      <Stop>
        <p style={{ margin: 0, fontWeight: 700 }}>Nothing here is signed, and nothing here is a redraw.</p>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          Every screen below renders the <em>same registered components</em> from the{" "}
          <em>same mock data</em> through the <em>same JSX</em>. The only thing that changes
          between two variants is seven <Mono>data-*</Mono> attributes on one wrapper, and every
          value they select is a token <Mono>globals.css</Mono> already declares. No{" "}
          <Mono>components.md</Mono> row moves, no <Mono>Signed-off:</Mono> date follows, and no
          work order is released by looking at this.
        </p>
      </Stop>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>How to read this page.</strong> Pick an axis in the strip below and the page
          shows that axis alone — every position on it, on one specimen, with the other six axes
          held at today&rsquo;s values. What you are choosing is <em>one position on one axis</em>.
          Seven of those is a design. The five presets further down are bookmarks for seven
          positions, and{" "}
          <Link href="/variants/compose" className="pv-mono">/variants/compose</Link> lets you set
          all seven yourself and see both whole screens under the result.
        </p>
      </Note>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>What a variant may not move, so you are not shown an option you cannot take.</strong>{" "}
          The four values you ruled on 2026-09-02 — the seven-step spacing ladder, the 1.25 heading
          scale, dark <Mono>--shadow-card</Mono>, dark <Mono>--ring-accent</Mono> — are law, and a
          variant <em>applies</em> them differently rather than replacing one. <Mono>--t-floor</Mono>{" "}
          holds: nothing renders under 11px in any position. §2.4&rsquo;s two chart colours hold, so
          the colour axis does not reach a chart at all. §2.5&rsquo;s meaning rules hold: an
          intended-empty state never takes <Mono>bad</Mono> or <Mono>warn</Mono> in any position,
          and a rival is never red. ADR-093 holds: every position renders at every band. Two
          positions want a token the registry does not hold — <Mono>--r-edge</Mono> and{" "}
          <Mono>--shadow-lift</Mono> — and both are marked <Mono>proposed</Mono> wherever they are
          spent.
        </p>
      </Note>

      <h2 className="pv-h2">What I would ship, and what I would refuse</h2>
      <P>
        A menu with no opinion is worth less than a menu with one, so mine is stated on every axis
        below rather than left implied. In short:{" "}
        <Link href="/variants/guardian/overview" className="pv-mono">/variants/guardian/overview</Link>{" "}
        and{" "}
        <Link href="/variants/guardian/report" className="pv-mono">/variants/guardian/report</Link>.
        Four decisions — the card edge becomes a fill, the card corner comes down to{" "}
        <Mono>--r-field</Mono> with the chip keeping its pill, the big mono number comes down to
        500, and the three stat tiles become the one module §4.5 already says they are — plus one
        that is not a taste: <Mono>chrome=&quot;hairline&quot;</Mono> is forced by{" "}
        <Mono>separation=&quot;fill&quot;</Mono>, because a sidebar at <Mono>--surface</Mono>{" "}
        beside cards at <Mono>--surface</Mono> is one enormous card. Density, colour and the
        heading weights do not move. It is composed, not chosen: no preset on this page holds it,
        which is the argument for the composer.
      </P>
      <div className="pv-note">
        <p style={{ margin: 0 }}>
          <strong>It spends no proposed token and needs no ruling on a value.</strong> Four
          positions, all of them selecting tokens <Mono>globals.css</Mono> declares today. The two
          proposed tokens on this page are in neither.
        </p>
      </div>
      <Stop>
        <p style={{ margin: 0, fontWeight: 700 }}>What I would refuse even if asked.</p>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          <Mono>radius=&quot;edge&quot;</Mono> and its <Mono>--r-edge</Mono>: 5px of corner over{" "}
          <Mono>crisp</Mono>, bought with a ruling on a fourth value in a set BUILD.md calls
          exact. <Mono>colour=&quot;mono&quot;</Mono> <em>on the public report</em>: the tone fill
          is the only redundant channel state has left, and a stranger reading once should not
          have to tell green ink from red ink. <Mono>separation=&quot;air&quot;</Mono> together
          with <Mono>chrome=&quot;bare&quot;</Mono> — the <Mono>open</Mono> preset — the shell and
          the page become one surface with nothing between them, and the degraded state loses the
          last frame it had. And an eighth spacing step: if <Mono>airy</Mono> is not enough air,
          the answer is fewer modules, not a longer ladder.
        </p>
      </Stop>

      <h2 className="pv-h2">Isolate one dimension</h2>
      <div className="pv-toggle" role="group" aria-label="axis">
        <button type="button" data-current={only === "all" ? "true" : "false"} onClick={() => setOnly("all")}>
          all seven
        </button>
        {AXES.map((a) => (
          <button
            key={a.id}
            type="button"
            data-current={only === a.id ? "true" : "false"}
            onClick={() => setOnly(a.id)}
          >
            {a.title.toLowerCase()}
          </button>
        ))}
      </div>

      {shown.map((axis) => (
        <section key={axis.id}>
          <h2 className="pv-h2">
            {axis.title} <span className="pv-mono">{axis.attr}</span>
          </h2>
          <P>{axis.moves}</P>
          <p className="pv-mono" style={{ margin: "0 0 var(--s-2)" }}>
            sets: {axis.tokens.join(" · ")}
          </p>
          <div className="pv-note">
            <p style={{ margin: 0 }}>
              <strong>Held fixed on this axis.</strong> {axis.fixed}
            </p>
          </div>
          <div className={`pv-grid${axis.specimen === "card" ? " pv-grid-2" : ""}`}>
            {axis.positions.map((pos) => (
              <div className="pv-cell" key={pos.id}>
                <div className="pv-cell-head">
                  <span className="pv-cell-name">
                    {axis.attr}=&quot;{pos.id}&quot;
                  </span>
                  {pos.proposes ? (
                    <span className="pv-flag">proposed · {pos.proposes}</span>
                  ) : pos.id === BASE[axis.id] ? (
                    <span className="pv-cell-note">today</span>
                  ) : null}
                </div>
                <div className="pv-cell-body">
                  <VariantScope tuple={{ ...BASE, [axis.id]: pos.id } as Tuple}>
                    <div className="rk" style={{ padding: "var(--s-3)", borderRadius: "var(--r-box)" }}>
                      <Specimen kind={axis.specimen} />
                    </div>
                  </VariantScope>
                  <p className="pv-p" style={{ margin: "var(--s-3) 0 0" }}>
                    {pos.note}
                  </p>
                  <p className="pv-p" style={{ margin: "var(--s-2) 0 0", color: "var(--pv-stop)" }}>
                    <strong>Costs:</strong> {pos.cost}
                  </p>
                  {pos.pick ? (
                    <div className="pv-note" style={{ margin: "var(--s-3) 0 0" }}>
                      <p style={{ margin: 0 }}>
                        <strong>
                          {pos.pick.startsWith("REFUSED") ? "I would refuse this." : "This is my pick on this axis."}
                        </strong>{" "}
                        {pos.pick}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <h2 className="pv-h2">The five presets, as tuples</h2>
      <P>
        Read a row across: that is the whole variant. Read a column down: that is one axis&rsquo;s
        positions as the presets spend them. A cell in bold is a move away from today.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>preset</th>
              {AXES.map((a) => (
                <th key={a.id}>{a.title.toLowerCase()}</th>
              ))}
              <th>moves</th>
            </tr>
          </thead>
          <tbody>
            {PRESETS.map((p) => (
              <tr key={p.id}>
                <td className="m">
                  <strong>{p.id}</strong>
                </td>
                {AXIS_IDS.map((id) => {
                  const moved = p.tuple[id] !== BASE[id];
                  const proposes = positionOf(id, p.tuple[id])?.proposes;
                  return (
                    <td key={id} className="m">
                      {moved ? <strong>{p.tuple[id]}</strong> : p.tuple[id]}
                      {proposes ? <> ·&nbsp;<span className="pv-flag">proposed</span></> : null}
                    </td>
                  );
                })}
                <td className="m">{movedAxes(p.tuple).length}/7</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">The presets, on both whole screens</h2>
      <P>
        Each preset renders the workspace and the public face — the two screens with the least in
        common, which is the point. The workspace is seen for five minutes most evenings by
        someone who already trusts the product; the report is seen once by a stranger who owes us
        nothing, and a token set that flatters one can quietly fail the other.
      </P>
      <div className="stack-3">
        {PRESETS.map((p) => {
          const proposed = proposedSpend(p.tuple);
          return (
            <div className="pv-stage" key={p.id} style={{ marginBottom: 0 }}>
              <div className="pv-axis-head">
                <span className="pv-mono" style={{ fontWeight: 700 }}>
                  {p.id}
                </span>
                <Link href={`/variants/${p.id}/overview`} className="pv-mono">
                  /variants/{p.id}/overview
                </Link>
                <Link href={`/variants/${p.id}/report`} className="pv-mono">
                  /variants/{p.id}/report
                </Link>
                {proposed.map((t) => (
                  <span className="pv-flag" key={t}>
                    proposed · {t}
                  </span>
                ))}
              </div>
              <p className="pv-p" style={{ margin: "var(--s-2) 0 0" }}>
                {p.intent}
              </p>
              <p className="pv-p" style={{ margin: "var(--s-1) 0 0" }}>
                <strong>Moves:</strong>{" "}
                {movedAxes(p.tuple).length
                  ? movedAxes(p.tuple)
                      .map((id) => `${AXES.find((a) => a.id === id)?.title} → ${p.tuple[id]}`)
                      .join(" · ")
                  : "nothing"}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="pv-h2">Compose your own</h2>
      <P>
        <Link href="/variants/compose" className="pv-mono">/variants/compose</Link> — seven
        pickers, both screens live under whatever you choose, and the resulting tuple printed at
        the top so you can hand it back as one line.
      </P>

      <h2 className="pv-h2">What this exploration needs that the registry does not hold</h2>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Wanted by</th>
              <th>Standing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="m">--r-edge</td>
              <td className="m">radius → edge</td>
              <td>
                <strong>Proposed.</strong> A fourth radius under <Mono>--r-field</Mono>. BUILD.md
                §2.1 fixes three and calls them exact values; this adds one rather than editing
                one. Refuse it and the <Mono>edge</Mono> position disappears — nothing else
                depends on it.
              </td>
            </tr>
            <tr>
              <td className="m">--shadow-lift</td>
              <td className="m">separation → shadow</td>
              <td>
                <strong>Proposed.</strong> An elevation shadow. <Mono>--shadow-card</Mono> is a 1px
                hairline shadow and cannot carry an edge once the border is gone. Its dark value is
                the light geometry re-inked at a second alpha — the construction §2.1 already uses
                for the <Mono>-bg</Mono>/<Mono>-line</Mono> pairs and the one your dark{" "}
                <Mono>--shadow-card</Mono> ruling took.
              </td>
            </tr>
            <tr>
              <td className="m">--s-8</td>
              <td className="m">density → airier than airy</td>
              <td>
                <strong>Not drawn, and named here so it is not smuggled in.</strong> The ruled
                ladder ends at <Mono>--s-7</Mono> 48px, so <Mono>airy</Mono> tops out there. A
                genuinely airier page section wants a 64px eighth step, which is a proposal against
                your own ruling rather than a parameter I may take. Say the word and it is one
                line; until then <Mono>airy</Mono> is the ceiling.
              </td>
            </tr>
            <tr>
              <td className="m">--t-eyebrow-track</td>
              <td className="m">type → quiet / loud</td>
              <td>
                <strong>Unnamed today, and spent anyway.</strong> §2.3 gives an eyebrow a size and
                a case and no tracking; <Mono>globals.css</Mono> spends <Mono>.09em</Mono> on{" "}
                <Mono>.eb</Mono> as a bare literal. The type axis needs a name for it. Whichever
                position you take, that value wants naming in <Mono>tokens.md</Mono>.
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollX>
    </main>
  );
}
