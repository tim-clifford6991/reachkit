// BUILD §3, REQ-099, REQ-001 — the landing page (UI-SPEC S1, issue #351).
//
// **This is the owner-approved screen set built, section for section.** The
// owner approved the complete set on 2026-09-08
// (`docs/design/approved/full-set/`, UI-SPEC S1) and it supersedes the card
// idiom this page was ported from on #266/#285: the accent hero is gone,
// the specimen card is gone, and the three narrative cards are gone. What
// stands in their place is the set's own drawing — header (3a), hero with
// the product component in a browser frame, the video frame (4c), sections
// 01/02/03 with live components, and the footer (3a).
//
// **REQ-001 c1 still holds, and is what shapes the CTAs.** The page
// presents "exactly one text input and one submit control": the hero's
// field and its own solid CTA. The header's CTA and the closing CTA are
// ruling 2b's second solid and REQ-099 c3's "every further call to action
// brings that one field into view with the cursor in it" — they are
// `type="button"` controls that focus the field (`FieldCta`), never a
// second submit and never a second field.
//
// **The video block renders, and that is ruling 4c**, which amended
// REQ-099 c6: "the demo video block renders a 16:9 frame with a play
// control and one written line before the asset exists". The old reading —
// the block does not render at all until an asset exists — was tokens.md
// §9.4's, and the ruling replaces it. The two strings are bracketed in the
// set and stay owed.
//
// **A Server Component.** It reads no session and no cookie, and it renders
// three live specimens — the hero component, the AI-answers matrix and the
// This-week card — which are server reads over the reserved fixture. The
// interactive parts are `ScanForm` and `FieldCta`, both client leaves.
import type React from "react";
import type { Metadata } from "next";
import { Calendar, Play, Search, Users } from "lucide-react";
import { Surface } from "@/ui/layout";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { HeroShot } from "./_landing/HeroShot";
import { MatrixCard } from "./_landing/MatrixCard";
import { WeekCard } from "./_landing/WeekCard";
import { FieldCta, FIELD_SECTION_ID } from "./_landing/FieldCta";
import { PUBLIC_ROUTE_SEO } from "./_seo/routes";
import { staticMetadata } from "./_seo/metadata";

type LandingSearchParams = { problem?: string; value?: string };

/** The three section numbers, as the set writes them — mono, accent, and a
 *  data identity rather than a sentence. Bound to a name before they reach
 *  JSX: the copy sweep reads every literal in a text position as product
 *  voice, and it is right to. */
const SECTION_NUMBER = ["01", "02", "03"] as const;

/** The three Step cards of section 03. Titles approved (11a), bodies owed.
 *  The step's own number rides the eyebrow's one slot. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body", Icon: Search },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body", Icon: Users },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body", Icon: Calendar },
] as const;

/** The five things the layout repeats, each named once so a rung is changed
 *  in one place: token utilities over `Canvas: Landing`'s own values. */
/** A hairline above, and the canvas's own block padding: 24 for the two
 *  narrative sections, 32 for the paired one, 48 around the video block. */
const SECTION_BASE = "col-span-full border-t border-base-300";
const SECTION = `${SECTION_BASE} py-(--s-5)`;
const SECTION_PAIRED = `${SECTION_BASE} py-(--s-6)`;
const SECTION_VIDEO = `${SECTION_BASE} py-(--s-7)`;
const PAIR = "grid grid-cols-1 items-center gap-(--s-6) lg:grid-cols-2 lg:gap-(--s-7)";
const READ = "min-w-0 max-w-(--w-read)";
const SECTION_N = "font-mono text-(length:--t-xs) text-primary";
/** `t-section` is the set's `.sec-h` weight and tracking; the size is the
 *  element's own `--h2` step (`src/ui/type.css`). */
const SECTION_H = "t-section mt-(--s-2) mb-(--s-3)";
const SECTION_S = "text-(color:--ink-2)";

/** Bound to a name before it reaches JSX, as the landing's other test ids
 *  are: the copy sweep reads a JSX attribute as product voice unless it is
 *  allow-listed. */
const VIDEO_TEST_ID = "landing-video";

/** Issue #326: the one public route a stranger is meant to arrive at from
 *  a search result, so the one whose `<head>` matters most. Indexable,
 *  named in the app host's sitemap, and its share image is the group's
 *  own — `opengraph-image.tsx` beside this file. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.landing);

export default function LandingPage(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
}): React.JSX.Element {
  // The screen root is a `Surface` with declared arms: one column until
  // 1024, two above it — `Canvas: Landing`'s own boundary. Every value below
  // is a token utility (#534); no idiom class and no viewport-height band.
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid">
        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section id={FIELD_SECTION_ID} className="col-span-full pt-(--s-6) pb-(--s-7) lg:pt-(--s-7)">
          <div className={PAIR}>
            <div className="min-w-0">
              {/* `t-hero` is the canvas's 46 px display line (owner ruling
                  2026-09-11 on #534); `src/ui/type.css` says why a class. */}
              <h1 className="t-hero">{copy("landing.headline")}</h1>
              <p className="mt-(--s-4) max-w-(--w-form) text-(length:--h4) text-(color:--ink-2)">
                {copy("landing.subline")}
              </p>
              {/* The set's `.field` row: the field and its control on one
                  row at the form measure (its 460 px resolves to
                  `--w-form`, 10a). */}
              <div className="mt-(--s-5)">
                <ScanForm searchParams={props.searchParams} />
              </div>
              <p className="mt-(--s-3) font-mono text-(length:--t-explain) text-(color:--ink-3)">
                {copy("landing.hero.assurance")}
              </p>
            </div>
            <HeroShot />
          </div>
        </section>

        {/* ══ THE DEMO VIDEO (4c) ═══════════════════════════════════════
            The frame, the play control and one written line; kept whether or
            not the asset exists, which is why `aspect-video` reserves the
            space and the play disc is a `<span>` (REQ-001 c1 counts
            controls). The frame is the canvas's own 16:9 at the read
            measure, centred — full width made it 288 px taller than drawn. */}
        <section className={SECTION_VIDEO}>
          <div
            data-testid={VIDEO_TEST_ID}
            className="relative mx-auto grid aspect-video w-full max-w-(--w-read) place-items-center overflow-hidden rounded-(--r-box) border border-base-300 bg-base-200"
          >
            <span
              className="grid size-[calc(var(--s-6)*2)] place-items-center rounded-(--r-pill) bg-primary text-primary-content"
              aria-hidden
            >
              <Play size={24} strokeWidth={1.8} />
            </span>
            <span className="absolute bottom-(--s-4) px-(--s-4) text-center font-mono text-(length:--t-explain) text-(color:--ink-3)">
              {copy("landing.video.line")}
            </span>
          </div>
          <p className="explain mt-(--s-3) text-center">{copy("landing.video.caption")}</p>
        </section>

        {/* ══ 01 · WHY SHOULD THEY CARE ═════════════════════════════════ */}
        <section className={SECTION}>
          <div className={PAIR}>
            <div className={READ}>
              <p className={SECTION_N}>
                <span className="num">{SECTION_NUMBER[0]}</span>
              </p>
              <h2 className={SECTION_H}>{copy("landing.why.heading")}</h2>
              <p className={SECTION_S}>{copy("landing.why.body")}</p>
            </div>
            <MatrixCard />
          </div>
        </section>

        {/* ══ 02 · WHAT IT DOES FOR THEM ════════════════════════════════
            The card leads in the source order, so it sits on the left at
            the two-column band and the page alternates against 01. */}
        <section className={SECTION_PAIRED}>
          <div className={PAIR}>
            <WeekCard />
            <div className={READ}>
              <p className={SECTION_N}>
                <span className="num">{SECTION_NUMBER[1]}</span>
              </p>
              <h2 className={SECTION_H}>{copy("landing.does.heading")}</h2>
              <p className={SECTION_S}>{copy("landing.does.body")}</p>
            </div>
          </div>
        </section>

        {/* ══ 03 · WHAT THEY DO TO START TODAY ══════════════════════════ */}
        <section className={SECTION}>
          <div className={`${READ} mx-auto text-center`}>
            <p className={SECTION_N}>
              <span className="num">{SECTION_NUMBER[2]}</span>
            </p>
            <h2 className={SECTION_H}>{copy("landing.start.heading")}</h2>
            <p className={SECTION_S}>{copy("landing.start.body")}</p>
          </div>

          {/* The set's `.g3`: three across, one column below 1024. */}
          <div className="mt-(--s-6) grid grid-cols-1 gap-(--s-4) lg:grid-cols-3 lg:items-start">
            {STEPS.map((step) => (
              <IdiomCard
                key={step.n}
                head={
                  <CardHead
                    icon={<step.Icon size={15} strokeWidth={1.8} aria-hidden />}
                    eyebrow={copy("landing.step.eyebrow", { n: step.n })}
                  />
                }
              >
                <h3>{copy(step.title)}</h3>
                <p className="explain">{copy(step.body)}</p>
              </IdiomCard>
            ))}
          </div>

          {/* The closing CTA: the hero's own action, stated a second time.
              REQ-099 c3 — it brings the field into view with the cursor in
              it, so it adds no second submit control. */}
          <div className="mt-(--s-6) flex flex-col items-center gap-(--s-2) text-center">
            <FieldCta label={copy("landing.start.cta")} />
            <p className="explain">{copy("landing.start.cancel")}</p>
          </div>
        </section>
      </main>
    </Surface>
  );
}
