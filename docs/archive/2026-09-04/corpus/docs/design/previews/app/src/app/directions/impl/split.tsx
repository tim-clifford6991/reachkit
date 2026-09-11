"use client";

/**
 * DIRECTION 4 — SPLIT. Master and detail.
 *
 * The argument: the screen is a workspace, not a rendering. A persistent
 * list on the left holds the index; the right pane holds one thing at a
 * time, at full depth. It is the only direction that can carry the twelve
 * questions, the five absent searches and the three problems without the
 * page becoming long — and the only one that is the natural shape for
 * §4.6's calendar and day panel, which the product already has.
 *
 * The comparison is a BULLET CHART: a qualitative range behind a measure
 * bar with a comparative tick. On the report the tick is the customer's own
 * value, so every rival's bar is read against the customer's position; on
 * the workspace the tick is the same rival's first measurement, so the bar
 * is read against where it started.
 *
 * State is carried by a LEADING RULE on the list item — a list of twenty
 * items is twenty hairlines, not twenty coloured blocks.
 *
 * THE PRIMARY ACTION IS PINNED TO THE MASTER PANE, not to a detail. An
 * argument behind an interaction does not get made, and this direction's
 * whole risk is exactly that. It is visible here rather than argued.
 *
 * COMPONENTS: SplitPane, MasterItem, BulletChart, Rail are PROPOSED. Btn,
 * Steps, Collapse and Table are registered rows, used unchanged.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Btn, Collapse, Steps, Table } from "@/components/registry/primitives";
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

type ItemTone = "neutral" | "accent" | "ok" | "warn" | "bad";

type Item = {
  id: string;
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  tone?: ItemTone;
};

/** MasterItem — PROPOSED. A leading rule, a name, one figure, one quiet
 *  line. Nothing here fills; only the rule carries tone. */
function MasterItem({
  item,
  current,
  onSelect,
}: {
  item: Item;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="d-item"
      data-current={current ? "true" : "false"}
      data-tone={item.tone ?? "neutral"}
      onClick={onSelect}
    >
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{item.label}</span>
      {item.value ? <span className="d-item-v">{item.value}</span> : <span />}
      {item.sub ? <span className="d-item-sub">{item.sub}</span> : null}
    </button>
  );
}

/** Rail — PROPOSED. The three destinations, compact, above the list. There
 *  is no sidebar in this direction: the master pane is the chrome. */
function Rail({ current }: { current: string }) {
  return (
    <nav className="d-rail">
      {DESTINATIONS.map((dest) => (
        <a
          key={dest}
          href="#"
          data-current={dest === current ? "true" : "false"}
          onClick={(e) => e.preventDefault()}
        >
          {dest}
          {dest === "Calendar" ? (
            <>
              {" "}
              <Num>{SHELL.counts.Calendar}</Num>
            </>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

/** BulletChart — PROPOSED, and a SIXTH form against §2.4's closed
 *  inventory. Range behind, measure bar in front, comparative tick on top.
 *  Two series colours only; the tick is --ink, which is not a series. */
function Bullet({
  rows,
  max,
  markLabel,
}: {
  rows: readonly { name: string; you: boolean; value: number; label: string; mark: number }[];
  max: number;
  markLabel: string;
}) {
  /* The qualitative range behind the measure bar: how far the field itself
     reaches. Derived from the rows, never a chosen band — a bullet chart
     whose range was invented would be inventing a measurement. */
  const range = Math.max(...rows.map((r) => r.value), 0);
  return (
    <div className="stack-3">
      {rows.map((r) => (
        <div className="d-bullet" key={r.name}>
          <div className="d-bullet-head">
            <span style={r.you ? { color: "var(--accent)" } : { color: "var(--ink-2)" }}>
              {r.name}
            </span>
            <span className="d-item-v">
              <Num>{r.label}</Num>
            </span>
          </div>
          <div className="d-bullet-track" title={`${r.name} · ${r.label}`}>
            <span className="d-bullet-range" style={{ width: `${(range / max) * 100}%` }} />
            <span
              className="d-bullet-fill"
              data-you={r.you ? "true" : "false"}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <span
              className="d-bullet-mark"
              style={{ left: `${(r.mark / max) * 100}%` }}
              title={markLabel}
            />
          </div>
        </div>
      ))}
      <p className="explain">{markLabel}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE PUBLIC REPORT
   ═══════════════════════════════════════════════════════════════════════ */

const REPORT_ITEMS = ["score", "ai", "google", "problems", "diy", "page", "price"] as const;
type ReportItemId = (typeof REPORT_ITEMS)[number];

export function SplitReport({ view }: { view: ReportView }) {
  const s = reportState(view);
  const [sel, setSel] = useState<ReportItemId>("google");
  const you = MARKET.find((m) => m.you);

  const items: readonly (Item & { id: ReportItemId })[] = [
    {
      id: "score",
      label: REPORT.category,
      value: <Num>{s.scoreText}</Num>,
      sub: REPORT.band,
      tone: "accent",
    },
    {
      id: "ai",
      label: REPORT.aiSourceChip,
      value: <Num>{`${you?.aiCited ?? 0}/${you?.aiAsked ?? 0}`}</Num>,
      sub: REPORT.methodChip,
      tone: "bad",
    },
    {
      id: "google",
      label: REPORT.googleSourceChip,
      value: <Num>{`${you?.presence ?? 0}/${PRESENCE_MAX}`}</Num>,
      tone: "bad",
    },
    {
      id: "problems",
      label: LABELS.moduleVerdict,
      value: <Num>{REPORT.problems.length}</Num>,
      tone: "warn",
    },
    {
      id: "diy",
      label: REPORT.methodChip,
      value: <Num>{REPORT.diy.length}</Num>,
      tone: "neutral",
    },
    {
      id: "page",
      label: LABELS.freePageEyebrow,
      sub: REPORT.freePage.ofN,
      tone: "ok",
    },
    {
      id: "price",
      label: LABELS.pricingEyebrow,
      value: <Num>{REPORT.pricing.price}</Num>,
      tone: "neutral",
    },
  ];

  return (
    <div className="rk d d-split-dir d-bleed">
      <div className="d-split">
        <aside className="d-master">
          <div className="stack-1">
            <span className="rk-h4">
              <Num>{REPORT.domain}</Num>
            </span>
            <span className="prov">
              <Num>{REPORT.measuredAt}</Num>
            </span>
          </div>
          {s.showModules ? (
            <div className="stack-1">
              {items.map((it) => (
                <MasterItem
                  key={it.id}
                  item={it}
                  current={sel === it.id}
                  onSelect={() => setSel(it.id)}
                />
              ))}
            </div>
          ) : (
            <p className="explain">{s.notice}</p>
          )}
          {/* Pinned: the one primary action, never behind a selection. */}
          <div className="stack-2">
            <Btn label={REPORT.freePage.cta} block />
            <Btn label={REPORT.copyLabel} variant="ghost" size="sm" block />
          </div>
        </aside>

        <div className="d-detail">
          {s.scanning ? (
            <>
              <Steps steps={REPORT.scanning} />
              <p className="explain">{s.notice}</p>
            </>
          ) : s.cooldown ? (
            <>
              <p className="t-sm" style={{ color: "var(--warn)" }}>
                {s.notice}
              </p>
              <Btn label={REPORT.retryLabel} variant="ghost" size="sm" />
            </>
          ) : sel === "score" ? (
            <>
              <p className="eb">{REPORT.category}</p>
              <span className="rk-num-big">
                <Num>{s.scoreText}</Num>
              </span>
              <span className="d-word">{REPORT.band}</span>
              <div className="stack-3">
                {REPORT.drivers.map((dr) => (
                  <div className="between t-sm" key={dr.label}>
                    <span className="dim">{dr.label}</span>
                    <span className="d-item-v">
                      <Num>{`${dr.value}/${dr.max}`}</Num>
                    </span>
                  </div>
                ))}
              </div>
              {s.degraded ? <p className="explain">{REPORT.degradedLine}</p> : null}
            </>
          ) : sel === "ai" ? (
            <>
              <p className="eb">{REPORT.aiSourceChip}</p>
              <h2 className="rk-h3">{LABELS.aiVerdict}</h2>
              {s.degraded ? (
                <p className="explain">{REPORT.degradedLine}</p>
              ) : (
                <>
                  <Bullet
                    max={you?.aiAsked ?? 1}
                    markLabel={REPORT.denominator}
                    rows={MARKET.filter((m) => m.aiAsked !== null).map((m) => ({
                      name: m.name,
                      you: m.you,
                      value: m.aiCited ?? 0,
                      label: `${m.aiCited}/${m.aiAsked}`,
                      mark: you?.aiCited ?? 0,
                    }))}
                  />
                  <p className="prov">{REPORT.methodChip}</p>
                  <p className="eb">{LABELS.twelveQuestions}</p>
                  <div className="stack-3">
                    {REPORT.questions.map((q) => (
                      <div className="stack-1" key={q.n}>
                        <div className="between t-sm">
                          <span>
                            <Num>{q.n}</Num> · {q.q}
                          </span>
                          <span className="d-word" data-tone="bad">
                            {REPORT.notYouBadge}
                          </span>
                        </div>
                        <p className="prov">
                          from: {q.from} · <Num>{q.vol}</Num> · named: {q.named}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Btn label={REPORT.showAll} variant="ghost" size="sm" />
                </>
              )}
            </>
          ) : sel === "google" ? (
            <>
              <p className="eb">{REPORT.googleSourceChip}</p>
              <h2 className="rk-h3">{LABELS.googleVerdict}</h2>
              <Bullet
                max={PRESENCE_MAX}
                markLabel={REPORT.footnoteF4}
                rows={MARKET.map((m) => ({
                  name: m.name,
                  you: m.you,
                  value: m.presence,
                  label: `${m.presence}/${PRESENCE_MAX}`,
                  mark: you?.presence ?? 0,
                }))}
              />
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
            </>
          ) : sel === "problems" ? (
            <>
              <p className="eb">{LABELS.moduleVerdict}</p>
              <div className="stack-4">
                {REPORT.problems.map((p, i) => (
                  <div className="stack-2" key={p.title}>
                    <span className="d-word" data-tone={p.tone === "ok" ? "ok" : "accent"}>
                      {p.badge}
                    </span>
                    <p className="rk-h4">{p.title}</p>
                    {i === 0 ? (
                      <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
                    ) : (
                      <span className="rk-h2 d-item-v">
                        <Num>{i === 1 ? "23" : "11"}</Num>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : sel === "diy" ? (
            <>
              <p className="eb">{REPORT.methodChip}</p>
              <div className="stack-2">
                {REPORT.diy.map((line) => (
                  <Collapse key={line} summary={line}>
                    <p className="explain">{REPORT.diyBody}</p>
                  </Collapse>
                ))}
              </div>
            </>
          ) : sel === "page" ? (
            <>
              <p className="eb">{LABELS.freePageEyebrow}</p>
              <h2 className="rk-h3">{REPORT.freePage.title}</h2>
              <div className="stack-2">
                {REPORT.freePage.rows.map((r) => (
                  <div className="between t-sm" key={r.k}>
                    <span className="dim">{r.k}</span>
                    <span className="d-item-v">
                      <Num>{r.v}</Num>
                    </span>
                  </div>
                ))}
              </div>
              <p className="prov">{REPORT.freePage.ofN}</p>
            </>
          ) : (
            <>
              <p className="eb">{LABELS.pricingEyebrow}</p>
              <span className="row" style={{ alignItems: "baseline" }}>
                <span className="rk-num-big">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE WORKSPACE
   ═══════════════════════════════════════════════════════════════════════ */

const OVERVIEW_ITEMS = ["growth", "score", "ai", "pages", "rivals", "week"] as const;
type OverviewItemId = (typeof OVERVIEW_ITEMS)[number];

export function SplitOverview({ view }: { view: OverviewView }) {
  const s = overviewState(view);
  const [sel, setSel] = useState<OverviewItemId>("rivals");
  const last = GROWTH[GROWTH.length - 1];

  const items: readonly (Item & { id: OverviewItemId })[] = [
    {
      id: "growth",
      label: OVERVIEW.growthLabel,
      value: <Num>{s.growth === "chart" ? last.value : "—"}</Num>,
      sub: s.growth === "failed" ? OVERVIEW.failedMeasurement : OVERVIEW.growthGoal,
      tone: s.growth === "failed" ? "warn" : "accent",
    },
    {
      id: "score",
      label: OVERVIEW.tiles.score.label,
      value: <Num>{s.scoreState === "unmeasured" ? "—" : OVERVIEW.tiles.score.value}</Num>,
      sub: OVERVIEW.tiles.score.delta,
      tone: "ok",
    },
    {
      id: "ai",
      label: OVERVIEW.tiles.ai.label,
      value: <Num>{OVERVIEW.tiles.ai.value}</Num>,
      sub: OVERVIEW.tiles.ai.goal,
      tone: "neutral",
    },
    {
      id: "pages",
      label: OVERVIEW.tiles.pages.label,
      value: <Num>{s.pagesState === "measured-zero" ? "0" : OVERVIEW.tiles.pages.value}</Num>,
      sub: OVERVIEW.tiles.pages.extra,
      tone: "neutral",
    },
    {
      id: "rivals",
      label: OVERVIEW.rivalsLabel,
      value: <Num>{TRACKED.length}</Num>,
      sub: OVERVIEW.rivalsDim,
      tone: "accent",
    },
    {
      id: "week",
      label: OVERVIEW.weekLabel,
      value: <Num>{WEEK.length}</Num>,
      sub: s.emptyQueue ? OVERVIEW.emptyQueue : SHELL.publishing.next,
      tone: s.emptyQueue ? "ok" : "warn",
    },
  ];

  return (
    <div className="rk d d-split-dir d-bleed">
      <div className="d-split">
        <aside className="d-master">
          <Rail current="Overview" />
          <div className="stack-1">
            <span className="rk-h4">
              <Num>{SHELL.domain}</Num>
            </span>
            <span className="prov">
              <Num>{SHELL.week}</Num>
            </span>
          </div>
          <div className="stack-1">
            {items.map((it) => (
              <MasterItem
                key={it.id}
                item={it}
                current={sel === it.id}
                onSelect={() => setSel(it.id)}
              />
            ))}
          </div>
          <div className="stack-2">
            {s.emptyQueue ? (
              <p className="t-sm" style={{ color: "var(--ok)" }}>
                {OVERVIEW.emptyQueue}
              </p>
            ) : (
              <Btn label={OVERVIEW.alerts[0].action} block />
            )}
          </div>
        </aside>

        <div className="d-detail">
          <div className="row">
            <h1 className="rk-h3">{OVERVIEW.head}</h1>
            <span className="d-word" data-tone="ok">
              {OVERVIEW.headBadge}
            </span>
          </div>

          {sel === "growth" ? (
            s.growth === "chart" ? (
              <>
                <p className="eb">{OVERVIEW.growthLabel}</p>
                <Bullet
                  max={Math.max(...GROWTH.map((g) => g.value))}
                  markLabel={OVERVIEW.growthGoal}
                  rows={GROWTH.map((g) => ({
                    name: g.label,
                    you: true,
                    value: g.value,
                    label: String(g.value),
                    mark: GROWTH[0].value,
                  }))}
                />
                <p className="prov">
                  <Num>{OVERVIEW.growthStart}</Num>
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
            )
          ) : sel === "rivals" ? (
            <>
              <p className="eb">{OVERVIEW.rivalsLabel}</p>
              {/* The tick is each rival's FIRST measurement, so the bar is
                  read against where that rival started. */}
              <Bullet
                max={GAP_MAX}
                markLabel={OVERVIEW.rivalsDim}
                rows={TRACKED.map((r) => ({
                  name: r.name,
                  you: false,
                  value: r.last ?? 0,
                  label: r.endpoint ?? "",
                  mark: r.first ?? 0,
                }))}
              />
              <div className="stack-2">
                {TRACKED.map((r) => (
                  <div className="between t-sm" key={r.name}>
                    <span className="dim">{r.name}</span>
                    <span className="prov">
                      <Num>{r.was}</Num>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : sel === "week" ? (
            <>
              <p className="eb">{OVERVIEW.weekLabel}</p>
              <div className="stack-1">
                {WEEK.map((d) => (
                  <div
                    className="d-item"
                    key={d.date}
                    data-tone={d.state === "today" ? "accent" : "neutral"}
                    data-current={d.state === "today" ? "true" : "false"}
                  >
                    <span>{d.label}</span>
                    <span className="d-item-v">
                      <Num>{d.date}</Num>
                    </span>
                  </div>
                ))}
              </div>
              <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
              {s.emptyQueue ? (
                <p className="t-sm" style={{ color: "var(--ok)" }}>
                  {OVERVIEW.emptyQueue}
                </p>
              ) : (
                <div className="stack-2">
                  {OVERVIEW.alerts.map((a, i) => (
                    <div className="between t-sm" key={a.message}>
                      <span style={{ color: "var(--warn)" }}>{a.message}</span>
                      <Btn
                        label={a.action}
                        variant={i === 0 ? "primary" : "ghost"}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="eb">
                {sel === "score"
                  ? OVERVIEW.tiles.score.label
                  : sel === "ai"
                    ? OVERVIEW.tiles.ai.label
                    : OVERVIEW.tiles.pages.label}
              </p>
              <span className="rk-num-big">
                <Num>
                  {sel === "score"
                    ? s.scoreState === "unmeasured"
                      ? "—"
                      : OVERVIEW.tiles.score.value
                    : sel === "ai"
                      ? OVERVIEW.tiles.ai.value
                      : s.pagesState === "measured-zero"
                        ? "0"
                        : OVERVIEW.tiles.pages.value}
                </Num>
              </span>
              <p className="explain">
                {sel === "score"
                  ? s.scoreState === "unmeasured"
                    ? OVERVIEW.growthNoMeasurement
                    : OVERVIEW.tiles.score.delta
                  : sel === "ai"
                    ? OVERVIEW.tiles.ai.goal
                    : OVERVIEW.tiles.pages.young}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
