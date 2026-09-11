"use client";

/**
 * DIRECTION 5 — NARRATIVE. The scrolling argument.
 *
 * The argument: the report is a link somebody was sent, opened on a phone,
 * read once. So design for that and stop reducing a desktop layout to fit
 * it. One full-bleed section per idea, each about a screenful, each with
 * its own edge-to-edge background, scrolled in order. There is no page
 * furniture — the only persistent element is a sticky bar carrying the one
 * primary action, which is therefore never off screen.
 *
 * The comparison is a FULL-WIDTH BAR SET: one bar per rival, name set
 * large above its own bar, figure inside it. The customer's zero is a
 * full-width empty track with the zero set in it — the loudest reading of
 * §2.5's "red appears only for the customer's problem being shown to them"
 * in this set, and the only place any direction spends --bad on a track.
 *
 * State is the section's own background, PLUS a word: a fill alone may
 * never carry meaning, so every toned section is captioned.
 *
 * WHAT THIS DIRECTION IS MISSING ON PURPOSE. It is the one that most wants
 * prose, and prose is exactly what a preview may not write (rule 7.3: long
 * generated text in a UI is a defect, and filler copy in a preview is the
 * same defect earlier). What you are looking at is the SHAPE of an argument
 * with the argument absent. Judge the shape; the sentences are the owner's.
 *
 * COMPONENTS: BleedSection, Hero, BigBar, StickyActionBar are PROPOSED, and
 * so are its two tokens (--d-display, --d-band). Btn, Collapse and Steps
 * are registered rows, used unchanged.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Btn, Collapse, Steps } from "@/components/registry/primitives";
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

type Fill = "surface" | "sunk" | "accent" | "ok" | "warn" | "bad";

/** BleedSection — PROPOSED. Edge to edge, min-height only, never a fixed
 *  height: a section that needs more room takes it and nothing clips. */
function Sec({
  fill = "surface",
  word,
  children,
}: {
  fill?: Fill;
  /** The explicit word beside the fill. A background alone never carries
   *  meaning, so this is required wherever `fill` is not the neutral one. */
  word?: string;
  children: ReactNode;
}) {
  return (
    <section className="d-sec" data-fill={fill}>
      <div className="d-sec-in">
        {word ? (
          <span className="d-word" data-tone={fill === "surface" || fill === "sunk" ? undefined : fill}>
            {word}
          </span>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Hero — PROPOSED. One number per section, at a step above the ruled
 *  scale's top. §2.5's "max one headline number per module" survives. */
function Hero({ value, lead }: { value: ReactNode; lead?: string }) {
  return (
    <div className="stack-3">
      <span className="d-hero">
        <Num>{value}</Num>
      </span>
      {lead ? <p className="d-lead">{lead}</p> : null}
    </div>
  );
}

/** BigBar — PROPOSED. Not the registered PresenceBars at a larger size: a
 *  different object. The name is set at heading size ABOVE its own track,
 *  the figure sits inside the track, and a zero is a marked empty track
 *  rather than an invisible one. */
function BigBar({
  rows,
  max,
}: {
  rows: readonly { name: string; you: boolean; value: number; label: string; sub?: string }[];
  max: number;
}) {
  return (
    <div className="d-bigbar">
      {rows.map((r) => (
        <div className="d-bigbar-row" key={r.name}>
          <div className="d-bigbar-head">
            <span
              className="d-bigbar-name"
              style={r.you ? { color: "var(--accent)" } : undefined}
            >
              {r.name}
            </span>
            <span className="d-bigbar-v">
              <Num>{r.label}</Num>
            </span>
          </div>
          <div
            className="d-bigbar-track"
            data-zero={r.you && r.value === 0 ? "true" : "false"}
            title={`${r.name} · ${r.label}`}
          >
            <span
              className="d-bigbar-fill"
              data-you={r.you ? "true" : "false"}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          {r.sub ? <p className="prov">{r.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE PUBLIC REPORT
   ═══════════════════════════════════════════════════════════════════════ */

export function NarrativeReport({ view }: { view: ReportView }) {
  const s = reportState(view);
  const you = MARKET.find((m) => m.you);

  return (
    <div className="rk d d-narrative d-bleed">
      <Sec>
        <p className="eb">
          <Num>{REPORT.domain}</Num> · <Num>{REPORT.measuredAt}</Num> · {REPORT.category}
        </p>
        <Hero value={s.scoreText} lead={REPORT.band} />
        {s.scanning ? (
          <Steps steps={REPORT.scanning} />
        ) : (
          <div className="stack-3">
            {REPORT.drivers.map((dr) => (
              <div className="between t-sm" key={dr.label}>
                <span className="dim">{dr.label}</span>
                <span className="d-bigbar-v">
                  <Num>{`${dr.value}/${dr.max}`}</Num>
                </span>
              </div>
            ))}
          </div>
        )}
        {s.notice ? <p className="d-lead">{s.notice}</p> : null}
        {s.cooldown ? <Btn label={REPORT.retryLabel} variant="ghost" /> : null}
      </Sec>

      {s.showModules ? (
        <>
          {/* The zero, at full bleed. This is the direction's whole reason
              to exist and it is one section. */}
          <Sec fill="bad" word={REPORT.notYouBadge}>
            <p className="eb">{REPORT.aiSourceChip}</p>
            <Hero
              value={`${you?.aiCited ?? 0}/${you?.aiAsked ?? 0}`}
              lead={s.degraded ? REPORT.degradedLine : REPORT.denominator}
            />
            <p className="prov">{REPORT.methodChip}</p>
          </Sec>

          {s.degraded ? null : (
            <Sec fill="sunk">
              <p className="eb">{LABELS.twelveQuestions}</p>
              <div className="stack-4">
                {REPORT.questions.map((q) => (
                  <div className="stack-1" key={q.n}>
                    <p className="d-lead">
                      <Num>{q.n}</Num> · {q.q}
                    </p>
                    <p className="prov">
                      from: {q.from} · <Num>{q.vol}</Num> · named: {q.named}
                    </p>
                  </div>
                ))}
              </div>
              <Btn label={REPORT.showAll} variant="ghost" />
            </Sec>
          )}

          <Sec>
            <p className="eb">{REPORT.googleSourceChip}</p>
            <h2 className="rk-h2">{LABELS.googleVerdict}</h2>
            <BigBar
              max={PRESENCE_MAX}
              rows={MARKET.map((m) => ({
                name: m.name,
                you: m.you,
                value: m.presence,
                label: `${m.presence}/${PRESENCE_MAX}`,
              }))}
            />
            <p className="explain">{REPORT.footnoteF4}</p>
          </Sec>

          <Sec fill="sunk">
            <p className="eb">{LABELS.absentHead}</p>
            {s.degraded ? (
              <p className="d-lead">{REPORT.absentEmpty}</p>
            ) : (
              <div className="stack-4">
                {REPORT.absent.map((r, i) => (
                  <div className="between" key={i}>
                    <span className="d-bigbar-name">
                      <Num>{r[0]}</Num>
                    </span>
                    <span className="stack-1" style={{ textAlign: "right" }}>
                      <span className="d-bigbar-v">
                        <Num>{r[1]}</Num>
                      </span>
                      <span className="prov">{r[2]}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Sec>

          <Sec fill="warn" word={REPORT.problems[1].badge}>
            <div className="stack-5">
              {REPORT.problems.map((p, i) => (
                <div className="stack-2" key={p.title}>
                  <span className="d-word">{p.badge}</span>
                  <p className="d-lead">{p.title}</p>
                  {i === 0 ? (
                    <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
                  ) : (
                    <span className="d-hero">
                      <Num>{i === 1 ? "23" : "11"}</Num>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Sec>

          <Sec>
            <p className="eb">{REPORT.methodChip}</p>
            <div className="stack-2">
              {REPORT.diy.map((line) => (
                <Collapse key={line} summary={line}>
                  <p className="explain">{REPORT.diyBody}</p>
                </Collapse>
              ))}
            </div>
          </Sec>

          <Sec fill="accent" word={LABELS.freePageEyebrow}>
            <h2 className="rk-h1">{REPORT.freePage.title}</h2>
            <div className="stack-3">
              {REPORT.freePage.rows.map((r) => (
                <div className="between t-sm" key={r.k}>
                  <span className="dim">{r.k}</span>
                  <span className="d-bigbar-v">
                    <Num>{r.v}</Num>
                  </span>
                </div>
              ))}
            </div>
            <Btn label={REPORT.freePage.cta} block />
            <p className="prov">{REPORT.freePage.ofN}</p>
          </Sec>

          <Sec fill="sunk">
            <p className="eb">{LABELS.pricingEyebrow}</p>
            <Hero value={REPORT.pricing.price} lead={REPORT.pricing.per} />
            <div className="stack-2">
              {REPORT.pricing.specs.map((sp) => (
                <p className="d-lead" key={sp}>
                  {sp}
                </p>
              ))}
            </div>
            <Btn label={REPORT.pricing.cta} variant="ghost" block />
            <p className="prov">{REPORT.pricing.cancel}</p>
          </Sec>
        </>
      ) : (
        <Sec fill="sunk">
          <p className="d-lead">{LABELS.waitingFrame}</p>
        </Sec>
      )}

      {/* StickyActionBar — PROPOSED. The one primary action, never off
          screen, in a direction that has no other chrome. */}
      <div className="d-actionbar">
        <span className="prov">
          <Num>{REPORT.domain}</Num>
        </span>
        <Btn label={REPORT.freePage.cta} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE WORKSPACE
   ═══════════════════════════════════════════════════════════════════════ */

export function NarrativeOverview({ view }: { view: OverviewView }) {
  const s = overviewState(view);
  const last = GROWTH[GROWTH.length - 1];
  const growthMax = Math.max(...GROWTH.map((g) => g.value));

  return (
    <div className="rk d d-narrative d-bleed">
      <div className="d-minibar">
        <span className="row-tight">
          <Num>{SHELL.domain}</Num>
          <span className="dimmer">·</span>
          <Num>{SHELL.week}</Num>
        </span>
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
            </a>
          ))}
        </nav>
      </div>

      <Sec fill="ok" word={OVERVIEW.headBadge}>
        <h1 className="rk-h1">{OVERVIEW.head}</h1>
        {s.growth === "chart" ? (
          <Hero value={last.value} lead={OVERVIEW.growthGoal} />
        ) : s.growth === "none" ? (
          <Hero value="—" lead={OVERVIEW.growthNoMeasurement} />
        ) : (
          <Hero value="—" lead={OVERVIEW.failedMeasurement} />
        )}
        <p className="prov">
          <Num>{OVERVIEW.growthStart}</Num>
        </p>
      </Sec>

      {s.growth === "chart" ? (
        <Sec>
          <p className="eb">{OVERVIEW.growthLabel}</p>
          <BigBar
            max={growthMax}
            rows={GROWTH.map((g) => ({
              name: g.label,
              you: true,
              value: g.value,
              label: String(g.value),
              sub: g.date,
            }))}
          />
        </Sec>
      ) : s.growth === "failed" ? (
        <Sec fill="warn" word={OVERVIEW.headBadge}>
          <p className="d-lead">{OVERVIEW.failedMeasurement}</p>
          <p className="prov">
            <Num>{OVERVIEW.lastMeasurement}</Num>
          </p>
        </Sec>
      ) : (
        <Sec fill="sunk">
          <p className="d-lead">{OVERVIEW.growthNoMeasurement}</p>
          <p className="prov">
            <Num>{OVERVIEW.growthFirstDue}</Num>
          </p>
        </Sec>
      )}

      <Sec fill="sunk">
        <div className="stack-6">
          <div className="stack-2">
            <p className="eb">{OVERVIEW.tiles.score.label}</p>
            <Hero
              value={s.scoreState === "unmeasured" ? "—" : OVERVIEW.tiles.score.value}
              lead={
                s.scoreState === "unmeasured"
                  ? OVERVIEW.growthNoMeasurement
                  : OVERVIEW.tiles.score.delta
              }
            />
          </div>
          <div className="stack-2">
            <p className="eb">{OVERVIEW.tiles.ai.label}</p>
            <Hero value={OVERVIEW.tiles.ai.value} lead={OVERVIEW.tiles.ai.goal} />
          </div>
          <div className="stack-2">
            <p className="eb">{OVERVIEW.tiles.pages.label}</p>
            <Hero
              value={s.pagesState === "measured-zero" ? "0" : OVERVIEW.tiles.pages.value}
              lead={
                s.pagesState === "measured-zero"
                  ? OVERVIEW.tiles.pages.young
                  : OVERVIEW.tiles.pages.extra
              }
            />
          </div>
        </div>
      </Sec>

      <Sec>
        <p className="eb">{OVERVIEW.rivalsLabel}</p>
        <h2 className="rk-h2">{LABELS.moduleVerdict}</h2>
        <BigBar
          max={GAP_MAX}
          rows={TRACKED.map((r) => ({
            name: r.name,
            you: false,
            value: r.last ?? 0,
            label: r.endpoint ?? "",
            sub: r.was ?? undefined,
          }))}
        />
        <p className="explain">{OVERVIEW.rivalsDim}</p>
      </Sec>

      <Sec
        fill={s.emptyQueue ? "ok" : "warn"}
        word={s.emptyQueue ? OVERVIEW.emptyQueue : SHELL.publishing.state}
      >
        <p className="eb">{OVERVIEW.weekLabel}</p>
        <div className="stack-3">
          {WEEK.map((d) => (
            <div className="between t-sm" key={d.date}>
              <span className="dim">{d.label}</span>
              <span className="d-bigbar-v">
                <Num>{d.date}</Num>
              </span>
            </div>
          ))}
        </div>
        {s.emptyQueue ? null : (
          <div className="stack-3">
            {OVERVIEW.alerts.map((a, i) => (
              <div className="between" key={a.message}>
                <span className="d-lead">{a.message}</span>
                <Btn label={a.action} variant={i === 0 ? "primary" : "ghost"} size="sm" />
              </div>
            ))}
          </div>
        )}
        <Btn label={OVERVIEW.openCalendar} variant="ghost" />
      </Sec>

      <div className="d-actionbar">
        <span className="prov">
          <Num>{SHELL.publishing.next}</Num>
        </span>
        {s.emptyQueue ? (
          <span className="d-word" data-tone="ok">
            {OVERVIEW.emptyQueue}
          </span>
        ) : (
          <Btn label={OVERVIEW.alerts[0].action} />
        )}
      </div>
    </div>
  );
}
