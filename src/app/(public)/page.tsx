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
import { Play } from "lucide-react";
import { Surface } from "@/ui/layout";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { HeroShot } from "./_landing/HeroShot";
import { MatrixCard } from "./_landing/MatrixCard";
import { WeekCard } from "./_landing/WeekCard";
import { FieldCta, FIELD_SECTION_ID } from "./_landing/FieldCta";

type LandingSearchParams = { problem?: string; value?: string };

/** The three section numbers, as the set writes them — mono, accent, and a
 *  data identity rather than a sentence. Bound to a name before they reach
 *  JSX: the copy sweep reads every literal in a text position as product
 *  voice, and it is right to. */
const SECTION_NUMBER = ["01", "02", "03"] as const;

/** The three Step cards of section 03. Titles approved (11a), bodies owed.
 *  The step's own number rides the eyebrow's one slot. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body" },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body" },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body" },
] as const;

export default function LandingPage(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
}): React.JSX.Element {
  return (
    // ADR-093 decision 6: the screen root is a `Surface` and its arms are
    // declared. The hero is one column until `medium` — the set opens it
    // into two at 1024, which is that band's own boundary — and the wide
    // band is the same, so the surface reads at `--w-wide` throughout.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid">
        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section id={FIELD_SECTION_ID} className="col-span-full rk-hero">
          <div className="rk-split rk-split-hero">
            <div className="rk-hero-copy">
              {/* APPROVED — BUILD §3's tagline, verbatim, and REQ-099 c2. */}
              <h1 className="rk-hero-h">{copy("landing.headline")}</h1>
              <p className="rk-hero-s">{copy("landing.subline")}</p>
              <ScanForm searchParams={props.searchParams} />
              <p className="rk-prov-line">{copy("landing.hero.assurance")}</p>
            </div>
            <HeroShot />
          </div>
        </section>

        {/* ══ THE DEMO VIDEO (4c) ═══════════════════════════════════════
            The frame, the play control and one written line. The play
            control is not a control yet — there is no asset for it to
            start — so it is drawn and not focusable, which is why it is a
            `<span>` and is `aria-hidden`: a button that does nothing is a
            promise the page cannot keep, and REQ-001 c1 counts controls. */}
        <section className="col-span-full rk-sec">
          <div className="rk-video">
            <span className="rk-play" aria-hidden>
              <Play size={24} strokeWidth={1.8} />
            </span>
            <span className="rk-video-line">{copy("landing.video.line")}</span>
          </div>
          <p className="rk-explain rk-center">{copy("landing.video.caption")}</p>
        </section>

        {/* ══ 01 · WHY SHOULD THEY CARE ═════════════════════════════════ */}
        <section className="col-span-full rk-sec">
          <div className="rk-split">
            <div className="rk-sec-read">
              <p className="rk-sec-n">
                <span className="num">{SECTION_NUMBER[0]}</span>
              </p>
              <h2 className="rk-sec-h">{copy("landing.why.heading")}</h2>
              <p className="rk-sec-s">{copy("landing.why.body")}</p>
            </div>
            <MatrixCard />
          </div>
        </section>

        {/* ══ 02 · WHAT IT DOES FOR THEM ════════════════════════════════
            The card leads in the source order, so it sits on the left at
            the two-column band and the page alternates against 01. */}
        <section className="col-span-full rk-sec">
          <div className="rk-split">
            <WeekCard />
            <div className="rk-sec-read">
              <p className="rk-sec-n">
                <span className="num">{SECTION_NUMBER[1]}</span>
              </p>
              <h2 className="rk-sec-h">{copy("landing.does.heading")}</h2>
              <p className="rk-sec-s">{copy("landing.does.body")}</p>
            </div>
          </div>
        </section>

        {/* ══ 03 · WHAT THEY DO TO START TODAY ══════════════════════════ */}
        <section className="col-span-full rk-sec">
          <div className="rk-sec-read rk-center rk-sec-centred">
            <p className="rk-sec-n">
              <span className="num">{SECTION_NUMBER[2]}</span>
            </p>
            <h2 className="rk-sec-h">{copy("landing.start.heading")}</h2>
            <p className="rk-sec-s">{copy("landing.start.body")}</p>
          </div>

          <div className="rk-three">
            {STEPS.map((step) => (
              <IdiomCard
                key={step.n}
                head={<CardHead eyebrow={copy("landing.step.eyebrow", { n: step.n })} />}
              >
                <h3 className="rk-step-h">{copy(step.title)}</h3>
                <p className="rk-explain">{copy(step.body)}</p>
              </IdiomCard>
            ))}
          </div>

          {/* The closing CTA: the hero's own action, stated a second time.
              REQ-099 c3 — it brings the field into view with the cursor in
              it, so it adds no second submit control. */}
          <div className="rk-center rk-close">
            <FieldCta label={copy("landing.start.cta")} />
            <p className="rk-explain">{copy("landing.start.cancel")}</p>
          </div>
        </section>
      </main>
    </Surface>
  );
}
