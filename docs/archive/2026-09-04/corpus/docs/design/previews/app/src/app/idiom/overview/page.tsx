"use client";

/**
 * /idiom/overview — TAKE A · SIX BOXES, in the idiom the owner approved on
 * 2026-09-02.
 *
 * "One card per module, three separate stat tiles, six boxes on the
 * overview." The modules and their order are BUILD.md §4.5's, unchanged:
 * growth · score · AI answers · pages published · rivals · this week. The
 * idiom changes how a box is drawn and where the request-to-act goes; it
 * changes no module, no number and no string.
 *
 * WHAT IS NOT SIGNED HERE. The owner approved an idiom. That is not a
 * signature on a preview (rule 7.3, step 3) and it moves no components.md
 * row: every row this screen renders is still `proposed`, and so are the
 * six values tokens.md §9 records and the five parts in ./parts.tsx.
 */
import { CalendarDays, ChevronRight, Eye, FileText, Gauge, Plug, Sparkles, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/registry/primitives";
import { GoalDots, GrowthLine, RivalSparkline, WeekStrip } from "@/components/registry/charts";
import { AppShell } from "@/components/walk/AppShell";
import { Mono, Note, P, SheetHead, Stop } from "@/components/chrome/sheet";
import { GROWTH, OVERVIEW, RIVALS, WEEK } from "@/mock/data";
import { ActionPanel, CardHead, IdiomBtn, IdiomCard, IdiomScope, StatFigure } from "../parts";

/* The band badge beside the score — a data identity supplied at runtime,
   the same slot the report carries. Not a string this preview writes. */
const BAND = "[band]";

export default function IdiomOverview() {
  return (
    <>
      <main className="pv-wrap" style={{ paddingBottom: "var(--s-4)" }}>
        <SheetHead
          title="Take A · Six boxes"
          carries="preview artifact · the approved card idiom · not production code · nothing here is signed"
        >
          <P>
            BUILD.md §4.5&rsquo;s five modules, drawn as six boxes: one card per module and the
            three stat tiles broken out as three separate boxes rather than one. The idiom is the
            owner&rsquo;s ruling of 2026-09-02; the modules, their order and every string are
            unchanged from the <Mono>/walk/app/overview</Mono> baseline standing beside it.
          </P>
        </SheetHead>
        <Stop>
          <p style={{ margin: 0, fontWeight: 700 }}>
            An approved idiom is not a signed preview.
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            Six values are <Mono>proposed</Mono> and spent on this screen —{" "}
            <Mono>--r-card</Mono>, <Mono>--shadow-lift</Mono>, <Mono>--t-num-headline-face</Mono>{" "}
            and, on the two other idiom routes, <Mono>--grad-accent</Mono>,{" "}
            <Mono>--on-accent-quiet</Mono> and <Mono>--w-form</Mono>. Two of them are the values
            the owner explicitly did not rule: the card radius (18 against the ruled{" "}
            <Mono>--r-box</Mono> 14) and the headline numeral face. The switch above the screen
            flips the second one; mono is the default, because mono is what BUILD.md §2.3 states.
          </p>
        </Stop>
        <Note>
          <p style={{ margin: 0 }}>
            <strong>One primary action on this screen, and it is the veto panel&rsquo;s.</strong>{" "}
            Everything else that can be clicked is secondary or quiet: the calendar link is a
            tertiary pill and the reconnect panel&rsquo;s CTA is not solid. §4.5 gives the module-5
            alerts equal weight; the idiom does not, because a screen with two solid accent buttons
            has no primary action.
          </p>
        </Note>
      </main>

      <IdiomScope>
        <AppShell current="Overview">
          <div className="stack-5">
            {/* Screen head — §4.5 module 1. Not a box: the four words are
                backed by the chart in box 1 directly under them. */}
            <div className="between">
              <h1 className="rk-h1">{OVERVIEW.head}</h1>
              <Badge tone="ok">{OVERVIEW.headBadge}</Badge>
            </div>

            {/* ── BOX 1 · Growth ────────────────────────────────────────
                Area fill under the accent line, endpoint dot with a
                --surface ring, the endpoint value and the start/goal
                footnote pair — §4.5's "endpoint labelled" plus its footnote
                pair, which is the idiom's "only the two endpoints
                labelled". The intermediate week marks carry an AXIS TICK,
                not a value label. */}
            <IdiomCard
              pad="lg"
              head={<CardHead icon={<TrendingUp size={16} strokeWidth={2} />} eyebrow={OVERVIEW.growthLabel} />}
            >
              <GrowthLine
                points={GROWTH}
                startNote={<>{OVERVIEW.growthStart}</>}
                goalNote={<>{OVERVIEW.growthGoal}</>}
              />
            </IdiomCard>

            {/* ── BOXES 2, 3, 4 · three separate stat tiles ─────────────
                Take A's whole difference from the takes beside it: three
                boxes, not one box with three columns. Each carries its own
                head, and each carries its delta or its goal — never bare
                (§4.5's data rule). */}
            <div className="ci-tiles">
              <IdiomCard
                head={
                  <CardHead
                    icon={<Gauge size={16} strokeWidth={2} />}
                    eyebrow={OVERVIEW.tiles.score.label}
                    pill={<Badge tone="ok">{OVERVIEW.tiles.score.delta}</Badge>}
                  />
                }
              >
                <StatFigure
                  label={OVERVIEW.tiles.score.label}
                  state="measured"
                  value={OVERVIEW.tiles.score.value}
                  delta={<Badge tone="neutral">{BAND}</Badge>}
                />
              </IdiomCard>

              <IdiomCard
                head={
                  <CardHead
                    icon={<Sparkles size={16} strokeWidth={2} />}
                    eyebrow={OVERVIEW.tiles.ai.label}
                    pill={<Badge tone="neutral">{OVERVIEW.tiles.ai.goal}</Badge>}
                  />
                }
              >
                <StatFigure
                  label={OVERVIEW.tiles.ai.label}
                  state="measured"
                  value={`${OVERVIEW.tiles.ai.value}/12`}
                  goal={<GoalDots have={2} goal={6} />}
                />
              </IdiomCard>

              <IdiomCard
                head={
                  <CardHead
                    icon={<FileText size={16} strokeWidth={2} />}
                    eyebrow={OVERVIEW.tiles.pages.label}
                  />
                }
              >
                <StatFigure
                  label={OVERVIEW.tiles.pages.label}
                  state="measured"
                  value={OVERVIEW.tiles.pages.value}
                  delta={<Badge tone="neutral">{OVERVIEW.tiles.pages.extra}</Badge>}
                  extra={<p className="explain">{OVERVIEW.tiles.pages.young}</p>}
                />
              </IdiomCard>
            </div>

            {/* ── BOX 5 · How far ahead each rival is ──────────────────── */}
            <IdiomCard
              pad="lg"
              head={<CardHead icon={<Users size={16} strokeWidth={2} />} eyebrow={OVERVIEW.rivalsLabel} />}
            >
              <div className="stack-3">
                {RIVALS.map((r) => (
                  <RivalSparkline
                    key={r.name}
                    arm="absolute"
                    name={r.name}
                    series={r.series}
                    endpoint={r.endpoint}
                    delta={r.delta}
                  />
                ))}
                <p className="explain">{OVERVIEW.rivalsDim}</p>
              </div>
            </IdiomCard>

            {/* ── BOX 6 · This week ─────────────────────────────────────
                FULL WIDTH AT EVERY BAND, and that is arithmetic: seven
                cells at --w-cell-min need 672 plus the card's padding, and
                no half column reaches it at any named breakpoint. Two-up
                would render seven cells under their own floor, which
                ADR-093 refuses.

                The two §4.5 alerts are TINTED PANELS here, not `Alert`s.
                "Anything asking the customer to act is a tinted panel" is
                the idiom's biggest lift and this is the screen where it
                shows: an alert states a fact, a panel asks for a decision,
                and the overview's module 5 is asking for two. */}
            <IdiomCard
              pad="lg"
              head={
                <CardHead
                  icon={<CalendarDays size={16} strokeWidth={2} />}
                  eyebrow={OVERVIEW.weekLabel}
                  pill={
                    <IdiomBtn
                      variant="tertiary"
                      size="sm"
                      label={OVERVIEW.openCalendar}
                      icon={<ChevronRight size={14} strokeWidth={2} aria-hidden />}
                    />
                  }
                />
              }
            >
              <WeekStrip days={WEEK} />
              <ActionPanel
                tone="accent"
                state="default"
                icon={<Eye size={16} strokeWidth={2} />}
                title={OVERVIEW.alerts[0].message}
                line={OVERVIEW.reMeasuring}
                cta={OVERVIEW.alerts[0].action}
              />
              <ActionPanel
                tone="warn"
                state="default"
                icon={<Plug size={16} strokeWidth={2} />}
                title={OVERVIEW.alerts[1].message}
                line={OVERVIEW.lastMeasurement}
                cta={OVERVIEW.alerts[1].action}
              />
            </IdiomCard>
          </div>
        </AppShell>
      </IdiomScope>

      <main className="pv-wrap" style={{ paddingTop: "var(--s-5)" }}>
        <h2 className="pv-h2">The tinted panel&rsquo;s three states</h2>
        <P>
          Rule 7.3 asks every data view for loading, empty and error. A tinted panel is not a data
          view — it is a request — so its three states are the ones a request has:{" "}
          <Mono>default</Mono>, <Mono>in-flight</Mono> and <Mono>withheld</Mono>. The third is the
          one that has to exist in the type: a disabled button with no written account is the
          defect, so <Mono>withheld</Mono> carries a required account and has no{" "}
          <Mono>cta</Mono> member at all.
        </P>
        <div className="rk ci" style={{ padding: "var(--s-4)", borderRadius: "var(--r-card)" }}>
          <div className="stack-3">
            <ActionPanel
              tone="accent"
              state="default"
              icon={<Eye size={16} strokeWidth={2} />}
              title={OVERVIEW.alerts[0].message}
              line={OVERVIEW.reMeasuring}
              cta={OVERVIEW.alerts[0].action}
            />
            <ActionPanel
              tone="accent"
              state="in-flight"
              icon={<Eye size={16} strokeWidth={2} />}
              title={OVERVIEW.alerts[0].message}
              line={OVERVIEW.reMeasuring}
              cta={OVERVIEW.alerts[0].action}
            />
            <ActionPanel
              tone="warn"
              state="withheld"
              icon={<Plug size={16} strokeWidth={2} />}
              title={OVERVIEW.alerts[1].message}
              line={OVERVIEW.lastMeasurement}
              withheldAccount={OVERVIEW.failedMeasurement}
            />
          </div>
        </div>

        <h2 className="pv-h2">What this route raises rather than answers</h2>
        <P>
          <strong>
            The idiom says &ldquo;only the two endpoints labelled&rdquo; and{" "}
            <Mono>GrowthLine</Mono> already does that
          </strong>{" "}
          — the endpoint carries its value and the footnote pair carries the start value and the
          goal, which is BUILD.md §4.5&rsquo;s own sentence. The intermediate marks under the plot
          carry a week TICK, not a value. If the ruling meant the ticks as well, that is a change
          to a registered chart&rsquo;s contract and not a CSS rule, so it is raised here and not
          taken. <Mono>/idiom</Mono> carries it with the rest.
        </P>
        <P>
          Two boxes take <Mono>pad=&quot;lg&quot;</Mono> and three do not. The idiom gives{" "}
          <Mono>--s-5</Mono> for a card and <Mono>--s-6</Mono> for a larger one, and which card is
          &ldquo;larger&rdquo; is a judgement no token can hold — ADR-093 decision 4 hands exactly
          that to the preview gate. It is set by the caller here so it is visible and arguable
          rather than inferred from a column count.
        </P>
        <p className="pv-p">
          <Link href="/idiom" className="pv-mono">
            /idiom
          </Link>{" "}
          ·{" "}
          <Link href="/walk/app/overview" className="pv-mono">
            /walk/app/overview — the baseline this is read against
          </Link>
        </p>
      </main>
    </>
  );
}
