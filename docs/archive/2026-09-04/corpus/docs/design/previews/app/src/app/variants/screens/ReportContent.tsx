"use client";

/**
 * /scan/{domain} — the free report, BUILD.md §4.1's six modules in order.
 *
 * Same relationship to /walk/report that OverviewContent has to
 * /walk/app/overview: the same registered components, the same mock data,
 * the same module order and the same four states. The walkthrough is left
 * exactly as it was.
 *
 * ONE THING IS DIFFERENT FROM THE WALKTHROUGH AND IT IS NOT A VARIANT.
 * §4.1 module 3 reads "Left border color = severity", and the walkthrough
 * spends that as an inline border on each problem card. Inline wins over
 * every stylesheet, so a radius or separation position could not reach
 * those three cards at all. Here the severity is passed in BY NAME as
 * --v-sev and the border is drawn in variants.css. No literal is passed
 * and no value changes; it is the same border, reachable.
 *
 * The two calls to action are unchanged, and so is the question about
 * them: §4.2 makes the giveaway the trade the page is built around, so it
 * is drawn primary and the €49 start is drawn as an outline. That is a
 * promise question, not a parameter, and no variant on this page touches
 * it.
 */
import type { CSSProperties } from "react";
import { Num } from "@/components/Num";
import {
  Alert,
  Badge,
  Btn,
  Card,
  Collapse,
  Divider,
  Progress,
  Steps,
  Table,
} from "@/components/registry/primitives";
import { AiDotMatrix } from "@/components/registry/surfaces";
import { PresenceBars } from "@/components/registry/charts";
import { CodeBlock } from "@/components/proposed";
import { MATRIX_ROWS, REPORT } from "@/mock/data";

export const REPORT_VIEWS = ["report", "scanning", "degraded", "cooldown"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

const SEVERITY = ["var(--ok)", "var(--accent)", "var(--warn)"] as const;

export function ReportContent({ view }: { view: ReportView }) {
  return (
    <div className="rk rk-main" style={{ borderRadius: "var(--r-box)" }}>
      <div className="v-modules" style={{ maxWidth: "var(--w-wide)", margin: "0 auto" }}>
        {/* ── 1 · header strip ───────────────────────────────────────────── */}
        <Card
          verdict={
            <div className="between" style={{ width: "100%", alignItems: "flex-start" }}>
              <div className="stack-1">
                <span className="rk-h3">
                  <Num>{REPORT.domain}</Num>
                </span>
                <span className="prov">
                  <Num>{REPORT.measuredAt}</Num> · {REPORT.category}
                </span>
              </div>
              <div className="row" style={{ alignItems: "baseline" }}>
                <span className="rk-num-big">
                  <Num>{view === "degraded" ? "—" : REPORT.score}</Num>
                </span>
                <Badge tone="neutral">{REPORT.band}</Badge>
              </div>
            </div>
          }
          provenance={REPORT.measuredAt}
        >
          {view === "scanning" ? (
            <Steps steps={REPORT.scanning} />
          ) : view === "cooldown" ? (
            <div className="stack-2">
              <Alert tone="warn" message={REPORT.cooldownLine} />
              <Btn label={REPORT.retryLabel} variant="ghost" size="sm" />
            </div>
          ) : (
            <div className="stack-2">
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: "var(--s-3)" }}>
                {REPORT.drivers.map((d) => (
                  <Progress key={d.label} label={d.label} value={d.value} max={d.max} />
                ))}
              </div>
              {view === "degraded" ? <p className="explain">{REPORT.degradedLine}</p> : null}
            </div>
          )}
          <div className="row">
            <Btn label={REPORT.copyLabel} variant="ghost" size="sm" />
          </div>
        </Card>

        {view === "scanning" || view === "cooldown" ? (
          <p className="explain">
            [waiting-frame line — owner&rsquo;s] · the rest of the report is absent, not blank, and
            no module below is rendered as a skeleton.
          </p>
        ) : (
          <>
            {/* ── 2 · two equal cards, never stacked in importance ────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 v-cards">
              <Card
                eyebrow={REPORT.aiSourceChip}
                verdict={<span className="rk-h3">[AI-answers verdict — owner&rsquo;s]</span>}
                provenance={REPORT.methodChip}
              >
                {view === "degraded" ? (
                  <p className="explain">{REPORT.degradedLine}</p>
                ) : (
                  <>
                    <AiDotMatrix rows={MATRIX_ROWS} countLine={REPORT.denominator} />
                    <Divider />
                    <p className="eb">[the 12 questions — owner&rsquo;s]</p>
                    <div className="stack-3">
                      {REPORT.questions.map((q) => (
                        <div className="stack-1" key={q.n}>
                          <div className="row">
                            <span className="t-sm">
                              <Num>{q.n}</Num> · {q.q}
                            </span>
                            <Badge tone="bad">{REPORT.notYouBadge}</Badge>
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
              </Card>

              <Card
                eyebrow={REPORT.googleSourceChip}
                verdict={<span className="rk-h3">[Google-search verdict — owner&rsquo;s]</span>}
                provenance={REPORT.measuredAt}
              >
                <PresenceBars rows={REPORT.presence} max={12} />
                <Divider />
                <p className="eb">[5 biggest searches you are absent from — owner&rsquo;s]</p>
                <Table
                  columns={["search", "/mo", "holds #1"]}
                  rows={
                    view === "degraded"
                      ? []
                      : REPORT.absent.map((r) => [
                          <Num key="a">{r[0]}</Num>,
                          <Num key="b">{r[1]}</Num>,
                          r[2],
                        ])
                  }
                  empty={REPORT.absentEmpty}
                />
                <p className="explain">{REPORT.footnoteF4}</p>
              </Card>
            </div>

            {/* ── 3 · three problem cards ────────────────────────────────── */}
            {/* Two-up at --breakpoint-md, three-up only at --breakpoint-xl:
                at 768 a third of the row is under a card's own measure and
                the code block inside the first card would scroll rather
                than read. */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 v-cards">
              {REPORT.problems.map((p, i) => (
                <div
                  className="rk-card rk-card-body v-problem"
                  key={p.title}
                  style={{ "--v-sev": SEVERITY[i] } as CSSProperties}
                >
                  <div className="row">
                    <Badge tone={p.tone}>{p.badge}</Badge>
                  </div>
                  <p className="rk-h4">{p.title}</p>
                  {i === 0 ? (
                    <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
                  ) : (
                    <p className="rk-h2">
                      <Num>{i === 1 ? "23" : "11"}</Num>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* ── 4 · DIY collapses ──────────────────────────────────────── */}
            <div className="stack-2">
              {REPORT.diy.map((s) => (
                <Collapse key={s} summary={s}>
                  <p className="explain">{REPORT.diyBody}</p>
                </Collapse>
              ))}
            </div>

            {/* ── 5 · free page card — THE primary action ────────────────── */}
            <Card
              accent
              eyebrow="[free page eyebrow — owner&rsquo;s]"
              verdict={<span className="rk-h3">{REPORT.freePage.title}</span>}
              provenance={REPORT.freePage.ofN}
            >
              <div className="rk-why">
                {REPORT.freePage.rows.map((r) => (
                  <div className="r" key={r.k}>
                    <span className="k">{r.k}</span>
                    <span className="v">
                      <Num>{r.v}</Num>
                    </span>
                  </div>
                ))}
              </div>
              <Btn label={REPORT.freePage.cta} block />
            </Card>

            {/* ── 6 · pricing ────────────────────────────────────────────── */}
            <Card
              eyebrow="[pricing eyebrow — owner&rsquo;s]"
              verdict={
                <span className="row" style={{ alignItems: "baseline" }}>
                  <span className="rk-num-big">
                    <Num>{REPORT.pricing.price}</Num>
                  </span>
                  <span className="dim t-sm">{REPORT.pricing.per}</span>
                </span>
              }
              provenance={REPORT.pricing.cancel}
            >
              <div className="stack-1">
                {REPORT.pricing.specs.map((s) => (
                  <p className="t-sm dim" key={s}>
                    {s}
                  </p>
                ))}
              </div>
              <Btn label={REPORT.pricing.cta} variant="ghost" block />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
