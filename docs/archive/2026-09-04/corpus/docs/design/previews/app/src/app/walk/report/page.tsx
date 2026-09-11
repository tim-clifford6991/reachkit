"use client";

import { useState } from "react";
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
import { StateBar, WalkBanner } from "@/components/chrome/WalkBanner";
import { Mono, Note, P, Stop } from "@/components/chrome/sheet";
import { MATRIX_ROWS, REPORT } from "@/mock/data";

type View = "report" | "scanning" | "degraded" | "cooldown";

export default function WalkReport() {
  const [view, setView] = useState<View>("report");

  return (
    <main className="pv-wrap">
      <WalkBanner
        screen="/scan/{domain} — the free report, public and permanent"
        spec="BUILD §4.1 · six modules, in order"
        primaryAction="[email-me CTA — owner's] (module 5)"
        proposed={["CodeBlock"]}
      >
        <div style={{ marginTop: "var(--s-3)" }}>
          <StateBar
            states={["report", "scanning", "degraded", "cooldown"]}
            value={view}
            onChange={(s) => setView(s as View)}
          />
        </div>
      </WalkBanner>

      <Stop>
        <p style={{ margin: 0 }}>
          <strong>Two calls to action live on this screen</strong> — the giveaway in module 5 and
          the €49 start in module 6 — and rule 7.3 allows one primary per screen. This walkthrough
          takes the giveaway as primary and renders the start as an outline, because §4.2 makes the
          giveaway the trade the page is built around. <em>That is a choice a preview may show and
          only you may rule.</em> It changes what the page pushes a stranger toward, which is a
          promise question, not a parameter.
        </p>
      </Stop>

      {/* --w-wide is the report's measure: --breakpoint-xl less 2 × --s-6.
          It replaces a raw 72rem, and is 64px wider than that — a change
          nobody can see, made so the value has a name. */}
      <div className="rk rk-main" style={{ borderRadius: "var(--r-box)" }}>
        <div className="stack-6" style={{ maxWidth: "var(--w-wide)", margin: "0 auto" }}>
          {/* ── 1 · header strip ─────────────────────────────────────────── */}
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
                {/* §4.1 module 1's three driver mini-bars. One column on a
                    phone, three across the header strip from
                    --breakpoint-sm — they were pinned to a raw 24rem, which
                    on a wide report left them huddled in one corner and on a
                    phone was wider than the card. */}
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
              [waiting-frame line — owner&rsquo;s] · the rest of the report is absent, not blank,
              and no module below is rendered as a skeleton.
            </p>
          ) : (
            <>
              {/* ── 2 · two equal cards, never stacked in importance ──────── */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--s-5)" }}>
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

              {/* ── 3 · three problem cards ──────────────────────────────── */}
              {/* Three problem cards. Two-up at --breakpoint-md, three-up
                  only at --breakpoint-xl: at 768 a third of the row is
                  under a card's own measure and the code block inside the
                  first card would scroll rather than read. */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: "var(--s-4)" }}>
                {REPORT.problems.map((p, i) => (
                  <div
                    className="rk-card rk-card-body"
                    key={p.title}
                    style={{
                      borderLeftWidth: "var(--s-1)",
                      borderLeftColor:
                        i === 0 ? "var(--ok)" : i === 1 ? "var(--accent)" : "var(--warn)",
                    }}
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

              {/* ── 4 · DIY collapses ────────────────────────────────────── */}
              <div className="stack-2">
                {REPORT.diy.map((s) => (
                  <Collapse key={s} summary={s}>
                    <p className="explain">{REPORT.diyBody}</p>
                  </Collapse>
                ))}
              </div>

              {/* ── 5 · free page card — THE primary action ──────────────── */}
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

              {/* ── 6 · pricing ──────────────────────────────────────────── */}
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

      <Note>
        <p style={{ margin: 0 }}>
          <strong>What the states do here.</strong> <Mono>scanning</Mono> shows named stages and no
          bare spinner; <Mono>degraded</Mono> drops a driver, prints the score as an em dash and
          leaves the absent table on its written empty line — the section is <em>absent with one
          line</em>, never a skeleton; <Mono>cooldown</Mono> is an honest message with a retry and
          <strong> no auto-restart</strong>. Every one of them is switchable at a real viewport,
          which is the whole difference from a sheet: you can watch the layout survive the state
          change rather than read that it does.
        </p>
      </Note>
      <P>
        The robots block is <Mono>CodeBlock</Mono>, which is <strong>proposed, not
        registered</strong> (components.md §4 gap 3) — it wears its mark on screen. Its content is
        the bracketed label, not the robots lines themselves: REQ-009 c2 requires them{" "}
        <em>verbatim</em>, and a preview that typed an approximation would be manufacturing the
        defect §8 exists to catch.
      </P>
    </main>
  );
}
