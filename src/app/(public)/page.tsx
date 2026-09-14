// BUILD §3 — the landing page (SPEC §1).
//
// One field, no account: the hero's `ScanForm` is exactly one text input and
// one submit control, and its Scan is the screen's one solid button. Every
// further call to action (`FieldCta`, outline) brings that field into view
// with the cursor in it — never a second submit and never a second field.
//
// The video block renders a 16:9 frame with a play control and one written
// line whether or not the asset exists; the play disc is a `<span>`, so it
// is not a control.
//
// A Server Component. It reads no session and no cookie; the three
// specimens (hero shot, AI-answers matrix, this-week card) are server reads
// over the reserved fixture. `ScanForm` and `FieldCta` are the client leaves.
import type React from "react";
import type { Metadata } from "next";
import { Calendar, Play, Search, Users } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { HeroShot } from "./_landing/HeroShot";
import { MatrixCard } from "./_landing/MatrixCard";
import { WeekCard } from "./_landing/WeekCard";
import { FieldCta, FIELD_SECTION_ID } from "./_landing/FieldCta";
import { PUBLIC_ROUTE_SEO } from "./_seo/routes";
import { staticMetadata } from "./_seo/metadata";

type LandingSearchParams = { problem?: string; value?: string };

/** The three section numbers — a data identity, not a sentence. */
const SECTION_NUMBER = ["01", "02", "03"] as const;

/** The three step cards of section 03. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body", Icon: Search, count: "01" },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body", Icon: Users, count: "02" },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body", Icon: Calendar, count: "03" },
] as const;

const STEP_TOTAL = "03";
function stepCount(count: string): string {
  return `${count}/${STEP_TOTAL}`;
}

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const VIDEO_TEST_ID = "landing-video";

const SECTION = "col-span-full border-t border-base-300 px-4 py-16";
const INNER = "mx-auto w-full max-w-6xl";
const PAIR = "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16";
const LABEL = "flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-primary";
/** Heading size and weight come from `type.css`'s element rules. */
const HEADING = "mt-2 mb-3";
const BODY = "text-base-content/70";

/** The one public route a stranger is meant to arrive at from a search
 *  result: indexable, in the sitemap, with its own share image. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.landing);

export default function LandingPage(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
}): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid">
        {/* ══ HERO ══ */}
        <section id={FIELD_SECTION_ID} className="col-span-full px-4 pt-12 pb-16 lg:pt-20">
          <div className={`${INNER} ${PAIR}`}>
            <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="t-hero">{copy("landing.headline")}</h1>
              <p className="mt-4 max-w-xl text-lg text-base-content/70">{copy("landing.subline")}</p>
              <div className="mt-8 w-full max-w-xl">
                <ScanForm searchParams={props.searchParams} />
              </div>
              <p className="mt-3 font-mono text-xs text-base-content/60">{copy("landing.hero.assurance")}</p>
            </div>
            <HeroShot />
          </div>
        </section>

        {/* ══ THE DEMO VIDEO ══ */}
        <section className={`${SECTION} bg-base-100`}>
          <div className={INNER}>
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {copy("landing.video.eyebrow")}
              </p>
              <h2>{copy("landing.video.heading")}</h2>
            </div>
            <div
              data-testid={VIDEO_TEST_ID}
              className="relative mx-auto mt-6 grid aspect-video w-full max-w-3xl place-items-center overflow-hidden rounded-box border border-base-300 bg-base-200"
            >
              <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-content" aria-hidden>
                <Play size={24} strokeWidth={1.75} />
              </span>
              <span className="absolute bottom-4 px-4 text-center font-mono text-xs text-base-content/60">
                {copy("landing.video.line")}
              </span>
            </div>
            <p className="mt-3 text-center text-sm text-base-content/70">{copy("landing.video.caption")}</p>
          </div>
        </section>

        {/* ══ 01 · WHY SHOULD THEY CARE ══ */}
        <section className={SECTION}>
          <div className={`${INNER} ${PAIR}`}>
            <div className="min-w-0 max-w-2xl text-center lg:text-left">
              <p className={`${LABEL} justify-center lg:justify-start`}>
                <span className="font-mono">{SECTION_NUMBER[0]}</span>
                <span>{copy("landing.why.eyebrow")}</span>
              </p>
              <h2 className={HEADING}>{copy("landing.why.heading")}</h2>
              <p className={BODY}>{copy("landing.why.body")}</p>
            </div>
            <MatrixCard />
          </div>
        </section>

        {/* ══ 02 · WHAT IT DOES FOR THEM ══ */}
        <section className={`${SECTION} bg-base-100`}>
          <div className={`${INNER} ${PAIR}`}>
            <div className="min-w-0 max-w-2xl">
              <p className={LABEL}>
                <span className="font-mono">{SECTION_NUMBER[1]}</span>
                <span>{copy("landing.does.eyebrow")}</span>
              </p>
              <h2 className={HEADING}>{copy("landing.does.heading")}</h2>
              <p className={BODY}>{copy("landing.does.body")}</p>
            </div>
            <div className="min-w-0 lg:order-first">
              <WeekCard />
            </div>
          </div>
        </section>

        {/* ══ 03 · WHAT THEY DO TO START TODAY ══ */}
        <section className={SECTION}>
          <div className={INNER}>
            <div className="mx-auto max-w-2xl text-center">
              <p className={`${LABEL} justify-center`}>
                <span className="font-mono">{SECTION_NUMBER[2]}</span>
                <span>{copy("landing.start.eyebrow")}</span>
              </p>
              <h2 className={HEADING}>{copy("landing.start.heading")}</h2>
              <p className={BODY}>{copy("landing.start.body")}</p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
              {STEPS.map((step) => (
                <div key={step.n} className="card border border-base-300 bg-base-100">
                  <div className="card-body">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                        <step.Icon size={16} strokeWidth={1.75} aria-hidden />
                        {copy("landing.step.eyebrow", { n: step.n })}
                      </span>
                      <span className="font-mono text-sm font-bold text-primary">{stepCount(step.count)}</span>
                    </div>
                    <h3 className="card-title">{copy(step.title)}</h3>
                    <p className="text-sm text-base-content/70">{copy(step.body)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ THE CLOSING CALL ══ The hero's own action, stated again: it
            brings the field into view, so it adds no second submit. */}
        <section className={`${SECTION} bg-base-100`}>
          <div className="flex flex-col items-center gap-2 text-center">
            <FieldCta label={copy("landing.start.cta")} />
            <p className="text-sm text-base-content/70">{copy("landing.start.cancel")}</p>
          </div>
        </section>
      </main>
    </Surface>
  );
}
