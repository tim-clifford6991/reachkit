"use client";

/**
 * DIRECTION 3 — RANKED. The board.
 *
 * The argument: the product's whole claim is a comparison, so make the page
 * the comparison. Both screens lead with ONE table of the market with the
 * customer in it as a row, and everything else on the page is subordinate
 * to that table. A stranger sees themselves at the bottom of a list without
 * a sentence being written; a returning customer opens the same list and
 * looks only at whether they moved.
 *
 * The magnitude is drawn INSIDE the cell, behind its own number, so the
 * ordering and the size are one object rather than a table beside a chart.
 * The gap module is a slope chart: `276×` and `78×` stop being a number and
 * a badge and become two positions with a line between them.
 *
 * State is carried by POSITION AND WEIGHT — the customer's row is found by
 * its rank, a leading rule and 700 weight, never by a fill.
 *
 * COMPONENTS: Board, MagnitudeCell, SlopeChart are PROPOSED. Btn, Tabs,
 * Collapse, Steps and Table are registered rows, used unchanged.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Btn, Collapse, Steps, Table, Tabs } from "@/components/registry/primitives";
import { CodeBlock } from "@/components/proposed";
import {
  ABSENT_COLUMNS,
  DESTINATIONS,
  GAP_MAX,
  GROWTH,
  LABELS,
  MARKET,
  OVERVIEW,
  PRESENCE_MAX,
  REPORT,
  SHELL,
  TRACKED,
  WEEK,
  type OverviewView,
  type ReportView,
  overviewState,
  reportState,
} from "../fixture";

/* ── the direction's own three components ────────────────────────────── */

type BoardRow = { key: string; you?: boolean; cells: readonly ReactNode[] };

/** Board — PROPOSED. A table whose contract includes a `you` row: the
 *  customer is IN the ranking, not beside it. The narrow form is designed
 *  in directions.css and drops no column. */
function Board({ columns, rows }: { columns: readonly string[]; rows: readonly BoardRow[] }) {
  return (
    <table className="d-board">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-you={r.you ? "true" : "false"}>
            {r.cells.map((cell, i) => (
              <td key={i} data-label={columns[i]}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** MagnitudeCell — PROPOSED. The bar is the cell's own background and the
 *  number sits on it. A zero draws no fill and still reads. */
function Mag({
  value,
  max,
  label,
  you,
}: {
  value: number;
  max: number;
  label: string;
  you?: boolean;
}) {
  return (
    <span className="d-mag" title={label}>
      <span
        className="d-mag-fill"
        data-you={you ? "true" : "false"}
        style={{ width: `${(value / max) * 100}%` }}
      />
      <span className="d-mag-v">
        <Num>{label}</Num>
      </span>
    </span>
  );
}

/** SlopeChart — PROPOSED, and a SIXTH form against §2.4's closed inventory.
 *  Two measured weeks on a shared scale, one line each, both ends direct-
 *  labelled, a tooltip on every mark. No text lives inside the viewBox. */
type SlopeRow = { name: string; from: number; to: number; fromLabel: string; toLabel: string };

function SlopeChart({ rows, max }: { rows: readonly SlopeRow[]; max: number }) {
  const y = (v: number) => 100 - (v / max) * 100;
  return (
    <>
      <div className="d-slope">
        <div className="d-slope-col">
          {rows.map((r) => (
            <span
              key={r.name}
              className="d-slope-lab"
              data-side="left"
              style={{ top: `${y(r.from)}%` }}
            >
              {r.name} <Num>{r.fromLabel}</Num>
            </span>
          ))}
        </div>
        <div className="d-slope-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
            {rows.map((r) => (
              <line
                key={r.name}
                x1="0"
                y1={y(r.from)}
                x2="100"
                y2={y(r.to)}
                stroke="var(--chart-rival)"
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {r.name} · {r.fromLabel} · {r.toLabel}
                </title>
              </line>
            ))}
          </svg>
        </div>
        <div className="d-slope-col">
          {rows.map((r) => (
            <span
              key={r.name}
              className="d-slope-lab"
              data-side="right"
              style={{ top: `${y(r.to)}%`, color: "var(--chart-you)" }}
            >
              <Num>{r.toLabel}</Num>
            </span>
          ))}
        </div>
      </div>
      {/* The narrow form. Same three rows, no plot — see directions.css. */}
      <div className="d-slope-fallback">
        {rows.map((r) => (
          <div className="between t-sm" key={r.name}>
            <span className="dim">{r.name}</span>
            <span className="row-tight">
              <span className="prov">
                <Num>{r.fromLabel}</Num>
              </span>
              <span className="d-cellnum" style={{ color: "var(--chart-you)", fontWeight: 700 }}>
                <Num>{r.toLabel}</Num>
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE PUBLIC REPORT
   ═══════════════════════════════════════════════════════════════════════ */

export function RankedReport({ view }: { view: ReportView }) {
  const s = reportState(view);

  return (
    <div className="rk d d-ranked d-bleed">
      <header className="d-topbar">
        <span className="row-tight">
          <span className="rk-h4">
            <Num>{REPORT.domain}</Num>
          </span>
          <span className="prov">
            <Num>{REPORT.measuredAt}</Num>
          </span>
        </span>
        <span className="row">
          <span className="d-cellnum rk-h3">
            <Num>{s.scoreText}</Num>
          </span>
          <span className="d-word">{REPORT.band}</span>
          <Btn label={REPORT.copyLabel} variant="ghost" size="sm" />
        </span>
      </header>
      <p className="d-crumbs">
        {REPORT.category} · <Num>{REPORT.measuredAt}</Num>
      </p>

      <div className="d-page">
        {s.scanning ? (
          <div className="stack-3">
            <Steps steps={REPORT.scanning} />
            <p className="explain">{s.notice}</p>
          </div>
        ) : s.cooldown ? (
          <div className="stack-3">
            <p className="t-sm" style={{ color: "var(--warn)" }}>
              {s.notice}
            </p>
            <Btn label={REPORT.retryLabel} variant="ghost" size="sm" />
            <p className="explain">{LABELS.waitingFrame}</p>
          </div>
        ) : (
          <>
            {/* THE BOARD — the whole argument, one object. */}
            <section className="stack-3">
              <p className="eb">{REPORT.googleSourceChip}</p>
              <Board
                columns={["#", REPORT.category, LABELS.googleVerdict, REPORT.aiSourceChip]}
                rows={MARKET.map((m, i) => ({
                  key: m.name,
                  you: m.you,
                  cells: [
                    <span className="d-rank" key="r">
                      <Num>{i + 1}</Num>
                    </span>,
                    m.name,
                    <Mag
                      key="m"
                      value={m.presence}
                      max={PRESENCE_MAX}
                      label={`${m.presence}/${PRESENCE_MAX}`}
                      you={m.you}
                    />,
                    m.aiAsked === null ? (
                      <span className="dimmer" key="a">
                        <Num>—</Num>
                      </span>
                    ) : (
                      <span className="d-cellnum" key="a">
                        <Num>{`${m.aiCited}/${m.aiAsked}`}</Num>
                      </span>
                    ),
                  ],
                }))}
              />
              <p className="explain">{REPORT.footnoteF4}</p>
              <p className="prov">{REPORT.methodChip}</p>
            </section>

            {s.degraded ? (
              <p className="t-sm" style={{ color: "var(--warn)" }}>
                {REPORT.degradedLine}
              </p>
            ) : null}

            <section className="stack-3">
              <p className="eb">{LABELS.twelveQuestions}</p>
              <Board
                columns={["#", REPORT.aiSourceChip, REPORT.notYouBadge]}
                rows={REPORT.questions.map((q) => ({
                  key: String(q.n),
                  cells: [
                    <span className="d-rank" key="r">
                      <Num>{q.n}</Num>
                    </span>,
                    <span key="q">
                      {q.q}
                      <br />
                      <span className="prov">
                        from: {q.from} · <Num>{q.vol}</Num> · named: {q.named}
                      </span>
                    </span>,
                    <span className="d-word" data-tone="bad" key="n">
                      {REPORT.notYouBadge}
                    </span>,
                  ],
                }))}
              />
              <Btn label={REPORT.showAll} variant="ghost" size="sm" />
            </section>

            <section className="stack-3">
              <p className="eb">{LABELS.absentHead}</p>
              <Table
                columns={ABSENT_COLUMNS}
                rows={
                  s.degraded
                    ? []
                    : REPORT.absent.map((r) => [
                        <Num key="a">{r[0]}</Num>,
                        <Num key="b">{r[1]}</Num>,
                        r[2],
                      ])
                }
                empty={REPORT.absentEmpty}
              />
            </section>

            <section className="stack-3">
              <p className="eb">{LABELS.moduleVerdict}</p>
              <Board
                columns={[REPORT.category, REPORT.band, LABELS.googleVerdict]}
                rows={REPORT.problems.map((p, i) => ({
                  key: p.title,
                  cells: [
                    p.title,
                    <span className="d-word" data-tone={p.tone === "ok" ? "ok" : "accent"} key="b">
                      {p.badge}
                    </span>,
                    i === 0 ? (
                      <span className="dimmer" key="c">
                        <Num>—</Num>
                      </span>
                    ) : (
                      <span className="d-cellnum rk-h4" key="c">
                        <Num>{i === 1 ? "23" : "11"}</Num>
                      </span>
                    ),
                  ],
                }))}
              />
              <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
            </section>

            <section className="stack-2">
              {REPORT.diy.map((line) => (
                <Collapse key={line} summary={line}>
                  <p className="explain">{REPORT.diyBody}</p>
                </Collapse>
              ))}
            </section>

            <section className="sunk stack-3">
              <p className="eb">{LABELS.freePageEyebrow}</p>
              <p className="rk-h4">{REPORT.freePage.title}</p>
              <Board
                columns={[REPORT.category, LABELS.googleVerdict]}
                rows={REPORT.freePage.rows.map((r) => ({
                  key: r.k,
                  cells: [
                    r.k,
                    <span className="d-cellnum" key="v">
                      <Num>{r.v}</Num>
                    </span>,
                  ],
                }))}
              />
              <Btn label={REPORT.freePage.cta} block />
              <p className="prov">{REPORT.freePage.ofN}</p>
            </section>

            <section className="sunk stack-3">
              <p className="eb">{LABELS.pricingEyebrow}</p>
              <span className="row" style={{ alignItems: "baseline" }}>
                <span className="d-cellnum rk-h1">
                  <Num>{REPORT.pricing.price}</Num>
                </span>
                <span className="dim t-sm">{REPORT.pricing.per}</span>
              </span>
              <div className="stack-1">
                {REPORT.pricing.specs.map((sp) => (
                  <p className="t-sm dim" key={sp}>
                    {sp}
                  </p>
                ))}
              </div>
              <Btn label={REPORT.pricing.cta} variant="ghost" block />
              <p className="prov">{REPORT.pricing.cancel}</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE WORKSPACE
   ═══════════════════════════════════════════════════════════════════════ */

export function RankedOverview({ view }: { view: OverviewView }) {
  const s = overviewState(view);
  const [tab, setTab] = useState(0);
  const growthMax = Math.max(...GROWTH.map((g) => g.value));

  return (
    <div className="rk d d-ranked d-bleed">
      <header className="d-topbar">
        <span className="row-tight">
          <span className="rk-h4">
            <Num>{SHELL.domain}</Num>
          </span>
          <span className="prov">
            <Num>{SHELL.week}</Num>
          </span>
        </span>
        <Tabs tabs={DESTINATIONS} selected={tab} onSelect={setTab} />
      </header>
      <p className="d-crumbs">
        <Num>{SHELL.domain}</Num> · {DESTINATIONS[0]} · <Num>{SHELL.publishing.next}</Num>
      </p>

      <div className="d-page">
        <div className="row">
          <h1 className="rk-h2">{OVERVIEW.head}</h1>
          <span className="d-word" data-tone="ok">
            {OVERVIEW.headBadge}
          </span>
        </div>

        {/* The board again, this time ranked by the gap. The customer has no
            gap of their own — the gap IS the distance to them — so this
            board carries the three tracked rivals and no `you` row, and the
            `—` in the customer's place is on the report's board instead. */}
        <section className="stack-3">
          <p className="eb">{OVERVIEW.rivalsLabel}</p>
          <Board
            columns={["#", REPORT.category, OVERVIEW.rivalsLabel, OVERVIEW.tiles.score.label]}
            rows={TRACKED.map((r, i) => ({
              key: r.name,
              cells: [
                <span className="d-rank" key="r">
                  <Num>{i + 1}</Num>
                </span>,
                r.name,
                <Mag
                  key="m"
                  value={r.last ?? 0}
                  max={GAP_MAX}
                  label={r.endpoint ?? ""}
                />,
                <span className="prov" key="w">
                  <Num>{r.was}</Num>
                </span>,
              ],
            }))}
          />
          <p className="explain">{OVERVIEW.rivalsDim}</p>
        </section>

        <section className="stack-3">
          <p className="eb">{LABELS.moduleVerdict}</p>
          <SlopeChart
            max={GAP_MAX}
            rows={TRACKED.map((r) => ({
              name: r.name,
              from: r.first ?? 0,
              to: r.last ?? 0,
              fromLabel: r.was ?? "",
              toLabel: r.endpoint ?? "",
            }))}
          />
        </section>

        <section className="stack-3">
          <p className="eb">{OVERVIEW.growthLabel}</p>
          {s.growth === "chart" ? (
            <>
              <Board
                columns={[REPORT.category, OVERVIEW.growthLabel]}
                rows={GROWTH.map((g) => ({
                  key: g.label,
                  cells: [
                    <span key="l">
                      {g.label}
                      <br />
                      <span className="prov">
                        <Num>{g.date}</Num>
                      </span>
                    </span>,
                    <Mag key="m" value={g.value} max={growthMax} label={String(g.value)} you />,
                  ],
                }))}
              />
              <p className="prov">
                <Num>{OVERVIEW.growthStart}</Num> · {OVERVIEW.growthGoal}
              </p>
            </>
          ) : s.growth === "none" ? (
            <div className="sunk stack-1">
              <p className="t-sm">{OVERVIEW.growthNoMeasurement}</p>
              <p className="prov">
                <Num>{OVERVIEW.growthFirstDue}</Num>
              </p>
            </div>
          ) : (
            <p className="t-sm" style={{ color: "var(--warn)" }}>
              {OVERVIEW.failedMeasurement}
            </p>
          )}
        </section>

        <section className="stack-3">
          <Board
            columns={[REPORT.category, OVERVIEW.growthLabel, OVERVIEW.tiles.ai.goal]}
            rows={[
              {
                key: "score",
                cells: [
                  OVERVIEW.tiles.score.label,
                  <span className="d-cellnum rk-h3" key="v">
                    <Num>{s.scoreState === "unmeasured" ? "—" : OVERVIEW.tiles.score.value}</Num>
                  </span>,
                  <span className="prov" key="c">
                    <Num>
                      {s.scoreState === "unmeasured"
                        ? OVERVIEW.growthNoMeasurement
                        : OVERVIEW.tiles.score.delta}
                    </Num>
                  </span>,
                ],
              },
              {
                key: "ai",
                cells: [
                  OVERVIEW.tiles.ai.label,
                  <span className="d-cellnum rk-h3" key="v">
                    <Num>{OVERVIEW.tiles.ai.value}</Num>
                  </span>,
                  <span className="prov" key="c">
                    {OVERVIEW.tiles.ai.goal}
                  </span>,
                ],
              },
              {
                key: "pages",
                cells: [
                  OVERVIEW.tiles.pages.label,
                  <span className="d-cellnum rk-h3" key="v">
                    <Num>
                      {s.pagesState === "measured-zero" ? "0" : OVERVIEW.tiles.pages.value}
                    </Num>
                  </span>,
                  <span className="prov" key="c">
                    {s.pagesState === "measured-zero"
                      ? OVERVIEW.tiles.pages.young
                      : OVERVIEW.tiles.pages.extra}
                  </span>,
                ],
              },
            ]}
          />
        </section>

        <section className="stack-3">
          <p className="eb">{OVERVIEW.weekLabel}</p>
          <Board
            columns={[REPORT.category, OVERVIEW.weekLabel]}
            rows={WEEK.map((d) => ({
              key: d.date,
              you: d.state === "today",
              cells: [
                <span className="d-rank" key="d">
                  <Num>{d.date}</Num>
                </span>,
                <span className="d-word" data-tone={d.state === "today" ? "accent" : undefined} key="s">
                  {d.label}
                </span>,
              ],
            }))}
          />
          <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
        </section>

        <section className="stack-3">
          {s.emptyQueue ? (
            <p className="t-sm" style={{ color: "var(--ok)" }}>
              {OVERVIEW.emptyQueue}
            </p>
          ) : (
            <Board
              columns={[REPORT.band, REPORT.category, OVERVIEW.openCalendar]}
              rows={OVERVIEW.alerts.map((a, i) => ({
                key: a.message,
                cells: [
                  <span className="d-word" data-tone="warn" key="t">
                    {SHELL.publishing.state}
                  </span>,
                  a.message,
                  <Btn
                    key="a"
                    label={a.action}
                    variant={i === 0 ? "primary" : "ghost"}
                    size="sm"
                  />,
                ],
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
