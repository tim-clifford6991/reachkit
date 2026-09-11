"use client";

/**
 * DIRECTION 2 — CONSOLE. The instrument panel.
 *
 * The argument: the returning customer opens this every morning and wants
 * to know what moved. Density is the feature. Regions are delimited by the
 * grid's own hairline gap — no card, no border, no radius, no shadow — and
 * every row carries a fixed status column on the left, so a scan down that
 * column IS the state of the account.
 *
 * The comparison technique is a SHARED-AXIS DOT PLOT. Five bars asks the
 * reader to compare five lengths; one axis with five dots on it puts the
 * customer's distance from the field in front of them as a distance. The
 * gap module uses the dumbbell arm of the same plot: `was` hollow, `now`
 * filled, a rule between, all on one scale — the two figures the badge used
 * to carry become two positions.
 *
 * Mono is structural here: every label, count, nav item and figure is
 * JetBrains Mono, and Jakarta appears once per screen. That is a reading of
 * §2.3 the type rule does not currently authorise — recorded in catalog.ts.
 *
 * COMPONENTS: Region, DotPlot, Dumbbell, CommandBar are PROPOSED. Btn,
 * Input, Kbd, Steps and Collapse are registered rows, used unchanged.
 */
import type { ReactNode } from "react";
import { Check, Circle, CircleDot, CornerDownLeft, Minus, Search } from "lucide-react";
import { Num } from "@/components/Num";
import { Btn, Collapse, Input, Kbd, Steps } from "@/components/registry/primitives";
import { CodeBlock } from "@/components/proposed";
import {
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

/* ── the direction's own four components ─────────────────────────────── */

/** CommandBar — PROPOSED. The whole of this direction's chrome. */
function CommandBar({ left, nav }: { left: ReactNode; nav?: ReactNode }) {
  return (
    <div className="d-cmdbar">
      {left}
      <span className="d-cmd-field">
        <Input label={LABELS.commandLabel} placeholder={LABELS.commandPlaceholder} />
      </span>
      <span className="row-tight">
        <Search size={14} strokeWidth={2} aria-hidden />
        <Kbd>/</Kbd>
        <CornerDownLeft size={14} strokeWidth={2} aria-hidden />
      </span>
      {nav}
    </div>
  );
}

/** Region — PROPOSED. A labelled area with no boundary of its own: the
 *  grid's hairline gap is the rule, so a region costs nothing to draw. */
function Region({
  label,
  count,
  wide,
  children,
}: {
  label: string;
  count?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`d-region${wide ? " d-region-wide" : ""}`}>
      <header className="d-region-h">
        <span>{label}</span>
        {count ? <span>{count}</span> : null}
      </header>
      {children}
    </section>
  );
}

type ConsoleRow = {
  key: string;
  mark: ReactNode;
  you?: boolean;
  label: ReactNode;
  value: ReactNode;
};

function Rows({ rows }: { rows: readonly ConsoleRow[] }) {
  return (
    <div className="d-rows">
      {rows.map((r) => (
        <div className="d-row" key={r.key}>
          <span className="d-row-mark" data-you={r.you ? "true" : "false"}>
            {r.mark}
          </span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{r.label}</span>
          <span className="d-row-v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** DotPlot — PROPOSED, and a SIXTH chart form against §2.4's closed
 *  inventory. Every mark is HTML positioned by percentage, so nothing is
 *  inside a viewBox and nothing can be scaled under the type floor. Two
 *  series colours only; the customer is the accent. */
function DotPlot({
  rows,
  max,
  ticks,
}: {
  rows: readonly { name: string; you: boolean; value: number; label: string }[];
  max: number;
  ticks: readonly number[];
}) {
  return (
    <div className="d-dp">
      {rows.map((r) => (
        <div className="d-dp-row" key={r.name}>
          <span className="d-dp-name" data-you={r.you ? "true" : "false"}>
            {r.name}
          </span>
          <span className="d-dp-track">
            <span className="d-dp-axis" />
            {ticks.map((t) => (
              <span key={t} className="d-dp-tick" style={{ left: `${(t / max) * 100}%` }} />
            ))}
            <span
              className="d-dp-dot"
              data-you={r.you ? "true" : "false"}
              style={{ left: `${(r.value / max) * 100}%` }}
              title={r.label}
            />
          </span>
          <span className="d-dp-v">
            <Num>{r.label}</Num>
          </span>
        </div>
      ))}
      <div className="d-dp-scale">
        {ticks.map((t) => (
          <span key={t}>
            <Num>{t}</Num>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dumbbell — PROPOSED, a SEVENTH chart form. The was/now arm of the same
 *  plot. No delta badge exists in this direction at all: the badge's job is
 *  done by the hollow dot's position. */
function Dumbbell({
  rows,
  max,
}: {
  rows: readonly { name: string; from: number; to: number; fromLabel: string; toLabel: string }[];
  max: number;
}) {
  return (
    <div className="d-dp">
      {rows.map((r) => {
        const a = (Math.min(r.from, r.to) / max) * 100;
        const b = (Math.max(r.from, r.to) / max) * 100;
        return (
          <div className="d-dp-row" key={r.name}>
            <span className="d-dp-name">{r.name}</span>
            <span className="d-dp-track">
              <span className="d-dp-axis" />
              <span className="d-dp-bar" style={{ left: `${a}%`, width: `${b - a}%` }} />
              <span
                className="d-dp-dot"
                data-hollow="true"
                style={{ left: `${(r.from / max) * 100}%` }}
                title={r.fromLabel}
              />
              <span
                className="d-dp-dot"
                data-you="true"
                style={{ left: `${(r.to / max) * 100}%` }}
                title={r.toLabel}
              />
            </span>
            <span className="d-dp-v">
              <Num>{r.toLabel}</Num>
            </span>
          </div>
        );
      })}
      <div className="d-dp-scale">
        <span>
          <Num>0</Num>
        </span>
        <span>
          <Num>{max}</Num>
        </span>
      </div>
    </div>
  );
}

const mark = (you: boolean) =>
  you ? <CircleDot size={12} strokeWidth={2} aria-hidden /> : <Circle size={12} strokeWidth={2} aria-hidden />;

/* ═══════════════════════════════════════════════════════════════════════
   THE PUBLIC REPORT
   ═══════════════════════════════════════════════════════════════════════ */

export function ConsoleReport({ view }: { view: ReportView }) {
  const s = reportState(view);

  return (
    <div className="rk d d-console d-bleed">
      <CommandBar
        left={
          <span className="row-tight">
            <Num>{REPORT.domain}</Num>
            <span className="dimmer">·</span>
            <Num>{REPORT.measuredAt}</Num>
          </span>
        }
        nav={<Btn label={REPORT.copyLabel} variant="ghost" size="sm" />}
      />

      <div className="d-grid">
        <Region label={REPORT.category} count={REPORT.band}>
          <span className="d-big">
            <Num>{s.scoreText}</Num>
          </span>
          {s.scanning ? (
            <Steps steps={REPORT.scanning} />
          ) : (
            <Rows
              rows={REPORT.drivers.map((dr) => ({
                key: dr.label,
                mark: mark(false),
                label: dr.label,
                value: <Num>{`${dr.value}/${dr.max}`}</Num>,
              }))}
            />
          )}
          {s.notice ? <p className="explain">{s.notice}</p> : null}
          {s.cooldown ? <Btn label={REPORT.retryLabel} variant="ghost" size="sm" /> : null}
        </Region>

        {s.showModules ? (
          <>
            <Region label={REPORT.aiSourceChip} count={REPORT.methodChip}>
              {s.degraded ? (
                <p className="explain">{REPORT.degradedLine}</p>
              ) : (
                <>
                  <Rows
                    rows={MARKET.filter((m) => m.aiAsked !== null).map((m) => ({
                      key: m.name,
                      mark: mark(m.you),
                      you: m.you,
                      label: m.name,
                      value: <Num>{`${m.aiCited}/${m.aiAsked}`}</Num>,
                    }))}
                  />
                  <p className="explain">{REPORT.denominator}</p>
                </>
              )}
            </Region>

            {/* The shared axis — this direction's whole argument in one
                object: four dots to the right and the customer's at zero. */}
            <Region label={REPORT.googleSourceChip} count={LABELS.googleVerdict} wide>
              <DotPlot
                max={PRESENCE_MAX}
                ticks={[0, PRESENCE_MAX / 2, PRESENCE_MAX]}
                rows={MARKET.map((m) => ({
                  name: m.name,
                  you: m.you,
                  value: m.presence,
                  label: `${m.presence}/${PRESENCE_MAX}`,
                }))}
              />
              <p className="explain">{REPORT.footnoteF4}</p>
            </Region>

            <Region label={LABELS.twelveQuestions} count={<Num>{REPORT.questions.length}</Num>}>
              <Rows
                rows={REPORT.questions.map((q) => ({
                  key: String(q.n),
                  mark: mark(false),
                  label: (
                    <>
                      <Num>{q.n}</Num> · {q.q}
                      <br />
                      <span className="prov">
                        {q.from} · <Num>{q.vol}</Num> · {q.named}
                      </span>
                    </>
                  ),
                  value: REPORT.notYouBadge,
                }))}
              />
              <Btn label={REPORT.showAll} variant="ghost" size="sm" />
            </Region>

            <Region label={LABELS.absentHead} count={<Num>{REPORT.absent.length}</Num>}>
              {s.degraded ? (
                <p className="explain">{REPORT.absentEmpty}</p>
              ) : (
                <Rows
                  rows={REPORT.absent.map((row, i) => ({
                    key: `${i}`,
                    mark: mark(false),
                    label: (
                      <>
                        <Num>{row[0]}</Num>
                        <br />
                        <span className="prov">{row[2]}</span>
                      </>
                    ),
                    value: <Num>{row[1]}</Num>,
                  }))}
                />
              )}
            </Region>

            <Region label={LABELS.moduleVerdict} count={<Num>{REPORT.problems.length}</Num>} wide>
              <Rows
                rows={REPORT.problems.map((p, i) => ({
                  key: p.title,
                  mark: mark(false),
                  label: (
                    <>
                      {p.title}
                      <br />
                      <span className="prov">{p.badge}</span>
                    </>
                  ),
                  value: i === 0 ? <Num>·</Num> : <Num>{i === 1 ? "23" : "11"}</Num>,
                }))}
              />
              <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
            </Region>

            <Region label={LABELS.freePageEyebrow} count={REPORT.freePage.ofN}>
              <dl className="d-kv">
                {REPORT.freePage.rows.map((r) => (
                  <div key={r.k} style={{ display: "contents" }}>
                    <dt>{r.k}</dt>
                    <dd>
                      <Num>{r.v}</Num>
                    </dd>
                  </div>
                ))}
              </dl>
              <Btn label={REPORT.freePage.cta} block />
            </Region>

            <Region label={LABELS.pricingEyebrow} count={REPORT.pricing.cancel}>
              <span className="d-big">
                <Num>{REPORT.pricing.price}</Num>
              </span>
              <dl className="d-kv">
                {REPORT.pricing.specs.map((sp) => (
                  <div key={sp} style={{ display: "contents" }}>
                    <dt>{sp}</dt>
                    <dd>
                      <Num>·</Num>
                    </dd>
                  </div>
                ))}
              </dl>
              <Btn label={REPORT.pricing.cta} variant="ghost" block />
            </Region>

            <Region label={REPORT.methodChip} count={<Num>{REPORT.diy.length}</Num>} wide>
              <div className="stack-2">
                {REPORT.diy.map((line) => (
                  <Collapse key={line} summary={line}>
                    <p className="explain">{REPORT.diyBody}</p>
                  </Collapse>
                ))}
              </div>
            </Region>
          </>
        ) : (
          <Region label={REPORT.category} wide>
            <p className="explain">{LABELS.waitingFrame}</p>
          </Region>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE WORKSPACE
   ═══════════════════════════════════════════════════════════════════════ */

export function ConsoleOverview({ view }: { view: OverviewView }) {
  const s = overviewState(view);
  const last = GROWTH[GROWTH.length - 1];

  return (
    <div className="rk d d-console d-bleed">
      <CommandBar
        left={
          <span className="row-tight">
            <Num>{SHELL.domain}</Num>
            <span className="dimmer">·</span>
            <Num>{SHELL.week}</Num>
          </span>
        }
        nav={
          <nav className="d-linkrow">
            {DESTINATIONS.map((dest) => (
              <a
                key={dest}
                href="#"
                className="d-link"
                data-current={dest === "Overview" ? "true" : "false"}
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
        }
      />

      <div className="d-grid">
        <Region label={OVERVIEW.growthLabel} count={OVERVIEW.headBadge} wide>
          {/* Jakarta appears exactly once on this screen, here. */}
          <h1 className="rk-h3" style={{ fontFamily: "var(--font-ui)" }}>
            {OVERVIEW.head}
          </h1>
          {s.growth === "chart" ? (
            <>
              <span className="d-big">
                <Num>{last.value}</Num>
              </span>
              <Rows
                rows={GROWTH.map((p) => ({
                  key: p.label,
                  mark: mark(false),
                  label: (
                    <>
                      {p.label} <span className="prov">{p.date}</span>
                    </>
                  ),
                  value: <Num>{p.value}</Num>,
                }))}
              />
              <p className="explain">
                <Num>{OVERVIEW.growthStart}</Num> · {OVERVIEW.growthGoal}
              </p>
            </>
          ) : s.growth === "none" ? (
            <>
              <p className="t-sm">{OVERVIEW.growthNoMeasurement}</p>
              <p className="prov">
                <Num>{OVERVIEW.growthFirstDue}</Num>
              </p>
            </>
          ) : (
            <p className="t-sm" style={{ color: "var(--warn)" }}>
              {OVERVIEW.failedMeasurement}
            </p>
          )}
        </Region>

        <Region label={OVERVIEW.tiles.score.label} count={OVERVIEW.tiles.score.delta}>
          <span className="d-big">
            <Num>{s.scoreState === "unmeasured" ? "—" : OVERVIEW.tiles.score.value}</Num>
          </span>
          {s.scoreState === "unmeasured" ? (
            <p className="explain">{OVERVIEW.growthNoMeasurement}</p>
          ) : null}
        </Region>

        <Region label={OVERVIEW.tiles.ai.label} count={OVERVIEW.tiles.ai.goal}>
          <span className="d-big">
            <Num>{OVERVIEW.tiles.ai.value}</Num>
          </span>
        </Region>

        <Region label={OVERVIEW.tiles.pages.label} count={OVERVIEW.tiles.pages.extra}>
          <span className="d-big">
            <Num>{s.pagesState === "measured-zero" ? "0" : OVERVIEW.tiles.pages.value}</Num>
          </span>
          <p className="explain">{OVERVIEW.tiles.pages.young}</p>
        </Region>

        <Region label={OVERVIEW.rivalsLabel} count={LABELS.moduleVerdict} wide>
          <Dumbbell
            max={GAP_MAX}
            rows={TRACKED.map((r) => ({
              name: r.name,
              from: r.first ?? 0,
              to: r.last ?? 0,
              fromLabel: r.was ?? "",
              toLabel: r.endpoint ?? "",
            }))}
          />
          <p className="explain">{OVERVIEW.rivalsDim}</p>
        </Region>

        <Region label={OVERVIEW.weekLabel} count={<Num>{WEEK.length}</Num>} wide>
          <Rows
            rows={WEEK.map((d) => ({
              key: d.date,
              mark:
                d.state === "done" ? (
                  <Check size={12} strokeWidth={2} aria-hidden />
                ) : d.state === "today" ? (
                  <CircleDot size={12} strokeWidth={2} aria-hidden />
                ) : d.state === "unmeasured" ? (
                  <Minus size={12} strokeWidth={2} aria-hidden />
                ) : (
                  <Circle size={12} strokeWidth={2} aria-hidden />
                ),
              you: d.state === "today",
              label: d.label,
              value: <Num>{d.date}</Num>,
            }))}
          />
          <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
        </Region>

        <Region label={SHELL.publishing.state} count={SHELL.publishing.next} wide>
          {s.emptyQueue ? (
            <Rows
              rows={[
                {
                  key: "empty",
                  mark: <Check size={12} strokeWidth={2} aria-hidden />,
                  label: OVERVIEW.emptyQueue,
                  value: <Num>·</Num>,
                },
              ]}
            />
          ) : (
            <div className="stack-2">
              {OVERVIEW.alerts.map((a, i) => (
                <div className="d-row" key={a.message}>
                  <span className="d-row-mark" style={{ color: "var(--warn)" }}>
                    <Circle size={12} strokeWidth={2} aria-hidden />
                  </span>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{a.message}</span>
                  <span className="d-row-v">
                    <Btn
                      label={a.action}
                      variant={i === 0 ? "primary" : "ghost"}
                      size="sm"
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Region>
      </div>
    </div>
  );
}
