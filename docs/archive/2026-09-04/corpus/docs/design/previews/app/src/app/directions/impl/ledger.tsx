"use client";

/**
 * DIRECTION 1 — LEDGER. The document.
 *
 * The argument: a public report is read once, by a stranger, on an unknown
 * display, and then forwarded. A document does that. It has one column at
 * every width, it prints, it reads in order, and every figure is available
 * to a scan because every figure is hung in the same margin column.
 *
 * What is deliberately absent: cards, shadows, radius on content, fills,
 * charts. The rival comparison is a dot-leader definition list — reading
 * order carries the rank and the numeral carries the magnitude. There is
 * not one plotted mark in this direction.
 *
 * COMPONENTS: RuledBand, FigureList, RuledNote are PROPOSED and declared in
 * catalog.ts. The registered set still does the work it can — Btn, Steps
 * and Collapse are components.md §1 rows and are used unchanged.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Btn, Collapse, Steps } from "@/components/registry/primitives";
import { CodeBlock } from "@/components/proposed";
import {
  ABSENT_COLUMNS,
  DESTINATIONS,
  LABELS,
  MARKET,
  OVERVIEW,
  PRESENCE_MAX,
  REPORT,
  SHELL,
  TRACKED,
  WEEK,
  GROWTH,
  type OverviewView,
  type ReportView,
  overviewState,
  reportState,
} from "../fixture";

/* ── the direction's own three components ────────────────────────────── */

/** RuledBand — PROPOSED. A rule, a figure in the margin, content in the
 *  measure. The whole page is made of these and of nothing else. */
function Band({
  figure,
  id,
  eyebrow,
  head,
  children,
}: {
  figure: ReactNode;
  id?: string;
  eyebrow?: string;
  head?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="d-band" id={id}>
      <div className="d-band-n">{figure}</div>
      <div className="d-band-body">
        {eyebrow ? <p className="eb">{eyebrow}</p> : null}
        {head ? <h2 className="rk-h3">{head}</h2> : null}
        {children}
      </div>
    </section>
  );
}

/** FigureList — PROPOSED. The dot-leader definition list. This is the
 *  direction's comparison technique and its data-presentation form at once:
 *  a name, a rule, a figure, optionally a provenance line under it. */
function Fig({
  k,
  v,
  you,
  sub,
}: {
  k: ReactNode;
  v: ReactNode;
  you?: boolean;
  sub?: ReactNode;
}) {
  return (
    <div>
      <div className="d-dl-row" data-you={you ? "true" : "false"}>
        <span className="d-dl-k">{k}</span>
        <span className="d-dl-lead" aria-hidden="true" />
        <span className="d-dl-v">
          <Num>{v}</Num>
        </span>
      </div>
      {sub ? <p className="prov">{sub}</p> : null}
    </div>
  );
}

/** RuledNote — PROPOSED. State without a fill: a leading rule in ink or a
 *  tone, an uppercase word, and the line itself. §2.5's meaning rules are
 *  held by the word, not by the rule — a rule alone carries nothing. */
function RuledNote({
  tone,
  word,
  line,
  children,
}: {
  tone?: "warn" | "ok" | "bad";
  word?: string;
  line?: string;
  children?: ReactNode;
}) {
  return (
    <div className="d-note" data-tone={tone ?? "ink"}>
      {word ? (
        <span className="d-word" data-tone={tone ?? "ink"}>
          {word}
        </span>
      ) : null}
      {line ? <p className="t-sm">{line}</p> : null}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE PUBLIC REPORT — §4.1's six modules as six numbered sections.
   ═══════════════════════════════════════════════════════════════════════ */

export function LedgerReport({ view }: { view: ReportView }) {
  const s = reportState(view);

  return (
    <div className="rk d d-ledger d-bleed">
      <article className="d-doc">
        <header className="d-runhead">
          <div className="stack-1">
            <span className="rk-h2">
              <Num>{REPORT.domain}</Num>
            </span>
            <span className="prov">
              <Num>{REPORT.measuredAt}</Num> · {REPORT.category}
            </span>
          </div>
          <Btn label={REPORT.copyLabel} variant="ghost" size="sm" />
        </header>

        {s.showModules ? (
          <ul className="d-toc">
            <li>
              <a href="#l-ai">
                <Num>01</Num> · {REPORT.aiSourceChip}
              </a>
            </li>
            <li>
              <a href="#l-google">
                <Num>02</Num> · {REPORT.googleSourceChip}
              </a>
            </li>
            <li>
              <a href="#l-problems">
                <Num>03</Num>
              </a>
            </li>
            <li>
              <a href="#l-diy">
                <Num>04</Num>
              </a>
            </li>
            <li>
              <a href="#l-page">
                <Num>05</Num> · {LABELS.freePageEyebrow}
              </a>
            </li>
            <li>
              <a href="#l-price">
                <Num>06</Num> · {LABELS.pricingEyebrow}
              </a>
            </li>
          </ul>
        ) : null}

        {/* header strip — the score is the figure, the drivers are the list */}
        <Band
          figure={
            <span className="d-fig">
              <Num>{s.scoreText}</Num>
            </span>
          }
        >
          <span className="d-word">{REPORT.band}</span>
          {s.scanning ? (
            <Steps steps={REPORT.scanning} />
          ) : (
            <div className="d-dl">
              {REPORT.drivers.map((dr) => (
                <Fig key={dr.label} k={dr.label} v={`${dr.value}/${dr.max}`} />
              ))}
            </div>
          )}
          {s.notice ? (
            <RuledNote tone={s.cooldown ? "warn" : undefined} line={s.notice} />
          ) : null}
          {s.cooldown ? <Btn label={REPORT.retryLabel} variant="ghost" size="sm" /> : null}
        </Band>

        {s.showModules ? (
          <>
            {/* 01 · AI answers */}
            <Band
              id="l-ai"
              figure={<Num>01</Num>}
              eyebrow={REPORT.aiSourceChip}
              head={LABELS.aiVerdict}
            >
              <p className="t-sm dim">{REPORT.denominator}</p>
              {s.degraded ? (
                <RuledNote tone="warn" line={REPORT.degradedLine} />
              ) : (
                <>
                  <div className="d-dl">
                    {MARKET.filter((m) => m.aiAsked !== null).map((m) => (
                      <Fig
                        key={m.name}
                        k={m.name}
                        you={m.you}
                        v={`${m.aiCited}/${m.aiAsked}`}
                      />
                    ))}
                  </div>
                  <p className="prov">{REPORT.methodChip}</p>
                  <p className="eb">{LABELS.twelveQuestions}</p>
                  <ul className="d-rule-list">
                    {REPORT.questions.map((q) => (
                      <li className="d-q" key={q.n}>
                        <div className="d-dl-row">
                          <span className="d-dl-k t-sm">
                            <Num>{q.n}</Num> · {q.q}
                          </span>
                          <span className="d-dl-lead" aria-hidden="true" />
                          <span className="d-word" data-tone="bad">
                            {REPORT.notYouBadge}
                          </span>
                        </div>
                        <p className="prov">
                          from: {q.from} · <Num>{q.vol}</Num> · named: {q.named}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Btn label={REPORT.showAll} variant="ghost" size="sm" />
                </>
              )}
            </Band>

            {/* 02 · Google search */}
            <Band
              id="l-google"
              figure={<Num>02</Num>}
              eyebrow={REPORT.googleSourceChip}
              head={LABELS.googleVerdict}
            >
              <div className="d-dl">
                {MARKET.map((m) => (
                  <Fig
                    key={m.name}
                    k={m.name}
                    you={m.you}
                    v={`${m.presence}/${PRESENCE_MAX}`}
                  />
                ))}
              </div>
              <p className="eb">{LABELS.absentHead}</p>
              {s.degraded ? (
                <p className="explain">{REPORT.absentEmpty}</p>
              ) : (
                <div className="d-dl">
                  {REPORT.absent.map((row, i) => (
                    <Fig
                      key={i}
                      k={row[0]}
                      v={row[1]}
                      sub={`${ABSENT_COLUMNS[2]}: ${row[2]}`}
                    />
                  ))}
                </div>
              )}
              <p className="explain">{REPORT.footnoteF4}</p>
            </Band>

            {/* 03 · the three problems */}
            <Band id="l-problems" figure={<Num>03</Num>}>
              <div className="stack-5">
                {REPORT.problems.map((p, i) => (
                  <RuledNote
                    key={p.title}
                    tone={p.tone === "ok" ? "ok" : undefined}
                    word={p.badge}
                  >
                    <p className="rk-h4">{p.title}</p>
                    {i === 0 ? (
                      <CodeBlock lines={REPORT.robotsLines} copyLabel={REPORT.copyLabel} />
                    ) : (
                      <span className="d-fig">
                        <Num>{i === 1 ? "23" : "11"}</Num>
                      </span>
                    )}
                  </RuledNote>
                ))}
              </div>
            </Band>

            {/* 04 · the method, free */}
            <Band id="l-diy" figure={<Num>04</Num>}>
              <div className="stack-2">
                {REPORT.diy.map((line) => (
                  <Collapse key={line} summary={line}>
                    <p className="explain">{REPORT.diyBody}</p>
                  </Collapse>
                ))}
              </div>
            </Band>

            {/* 05 · the free page — THE primary action */}
            <Band
              id="l-page"
              figure={<Num>05</Num>}
              eyebrow={LABELS.freePageEyebrow}
              head={REPORT.freePage.title}
            >
              <div className="d-dl">
                {REPORT.freePage.rows.map((r) => (
                  <Fig key={r.k} k={r.k} v={r.v} />
                ))}
              </div>
              <Btn label={REPORT.freePage.cta} block />
              <p className="prov">{REPORT.freePage.ofN}</p>
            </Band>

            {/* 06 · pricing */}
            <Band
              id="l-price"
              figure={
                <span className="d-fig">
                  <Num>{REPORT.pricing.price}</Num>
                </span>
              }
              eyebrow={LABELS.pricingEyebrow}
            >
              <p className="t-sm dim">{REPORT.pricing.per}</p>
              <div className="d-dl">
                {REPORT.pricing.specs.map((sp) => (
                  <Fig key={sp} k={sp} v="·" />
                ))}
              </div>
              <Btn label={REPORT.pricing.cta} variant="ghost" block />
              <p className="prov">{REPORT.pricing.cancel}</p>
            </Band>
          </>
        ) : (
          <Band figure={<Num>—</Num>}>
            <p className="explain">{LABELS.waitingFrame}</p>
          </Band>
        )}
      </article>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THE WORKSPACE — §4.5's five modules as the same document.
   No sidebar exists in this direction; the destinations are links in the
   running head. That is the cost, and it is visible rather than argued.
   ═══════════════════════════════════════════════════════════════════════ */

export function LedgerOverview({ view }: { view: OverviewView }) {
  const s = overviewState(view);
  const lastGrowth = GROWTH[GROWTH.length - 1];

  return (
    <div className="rk d d-ledger d-bleed">
      <article className="d-doc">
        <header className="d-runhead">
          <div className="stack-1">
            <span className="rk-h2">
              <Num>{SHELL.domain}</Num>
            </span>
            <span className="prov">
              <Num>{SHELL.week}</Num>
            </span>
          </div>
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
        </header>

        <Band
          figure={
            s.growth === "chart" ? (
              <span className="d-fig">
                <Num>{lastGrowth.value}</Num>
              </span>
            ) : (
              <span className="d-fig">
                <Num>—</Num>
              </span>
            )
          }
          eyebrow={OVERVIEW.growthLabel}
          head={OVERVIEW.head}
        >
          <span className="d-word" data-tone="ok">
            {OVERVIEW.headBadge}
          </span>
          {s.growth === "chart" ? (
            <>
              <div className="d-dl">
                {GROWTH.map((p) => (
                  <Fig key={p.label} k={p.label} v={p.value} sub={p.date} />
                ))}
              </div>
              <p className="prov">
                <Num>{OVERVIEW.growthStart}</Num> · {OVERVIEW.growthGoal}
              </p>
            </>
          ) : s.growth === "none" ? (
            <RuledNote line={OVERVIEW.growthNoMeasurement}>
              <p className="prov">
                <Num>{OVERVIEW.growthFirstDue}</Num>
              </p>
            </RuledNote>
          ) : (
            <RuledNote tone="warn" line={OVERVIEW.failedMeasurement} />
          )}
        </Band>

        <Band figure={<Num>01</Num>}>
          <div className="d-dl">
            <Fig
              k={OVERVIEW.tiles.score.label}
              v={s.scoreState === "unmeasured" ? "—" : OVERVIEW.tiles.score.value}
              sub={
                s.scoreState === "unmeasured"
                  ? OVERVIEW.growthNoMeasurement
                  : OVERVIEW.tiles.score.delta
              }
            />
            <Fig
              k={OVERVIEW.tiles.ai.label}
              v={OVERVIEW.tiles.ai.value}
              sub={OVERVIEW.tiles.ai.goal}
            />
            <Fig
              k={OVERVIEW.tiles.pages.label}
              v={s.pagesState === "measured-zero" ? "0" : OVERVIEW.tiles.pages.value}
              sub={
                s.pagesState === "measured-zero"
                  ? OVERVIEW.tiles.pages.young
                  : OVERVIEW.tiles.pages.extra
              }
            />
          </div>
        </Band>

        {/* The gap, with no chart at all: two figures set in one line. */}
        <Band figure={<Num>02</Num>} eyebrow={OVERVIEW.rivalsLabel}>
          <div className="stack-4">
            {TRACKED.map((r) => (
              <div className="stack-1" key={r.name}>
                <div className="d-figline">
                  <span className="t-sm dim">{r.name}</span>
                  <span className="d-fig">
                    <Num>{r.endpoint}</Num>
                  </span>
                  <span className="prov">
                    <Num>{r.was}</Num>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="explain">{OVERVIEW.rivalsDim}</p>
        </Band>

        <Band figure={<Num>03</Num>} eyebrow={OVERVIEW.weekLabel}>
          <div className="d-dl">
            {WEEK.map((d) => (
              <Fig key={d.date} k={d.label} v={d.date} />
            ))}
          </div>
          <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
          {s.emptyQueue ? (
            <RuledNote tone="ok" line={OVERVIEW.emptyQueue} />
          ) : (
            <div className="stack-3">
              {OVERVIEW.alerts.map((a, i) => (
                <RuledNote key={a.message} tone="warn" line={a.message}>
                  <Btn
                    label={a.action}
                    variant={i === 0 ? "primary" : "ghost"}
                    size="sm"
                  />
                </RuledNote>
              ))}
            </div>
          )}
        </Band>
      </article>
    </div>
  );
}
