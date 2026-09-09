// src/app/(public)/signin/page.tsx — REQ-098 (issue #19)
//
// "One screen that asks for the address I pay with and sends me a link, and
// that tells me plainly when a link I am holding no longer works" — REQ-098.
// It is the screen anyone without a session meets: `src/middleware.ts`
// redirects every denied path here, with no query string and no
// distinguishing header, so nothing about the redirect says whether an
// account exists (REQ-020 criterion 5).
//
// **No section marker.** `BUILD.md` has no §4 row for this screen — §1 names
// "magic-link auth" and §4 lists six screens, none of them this one — so
// there is no section for this file to mark and none is invented. Named in
// the pull request as something `BUILD.md` owes a row for.
//
// **Criterion 1, structurally:** one email input and one submit control and
// nothing else to fill in. No password field, no social sign-in, no control
// that opens an account — the only other control on the screen is the link
// to the landing page criterion 2's own last line carries.
//
// **Criterion 2's five strings are the owner's**, transcribed into
// `keys/signin.ts` from the requirement, which states them verbatim. The
// field's visible label is not among them and `Input` requires one with no
// default (BP-018 decision 2), so the placeholder key fills both — the same
// move, in reverse, that `src/app/(public)/page.tsx` makes with
// `landing.field.label`.
//
// **Criteria 3, 6 and 7 are structurally complete and speak the marker.**
// Each of the four answers, and the dead-link line, resolves from a copy key
// REQ-098's own third open question records as written nowhere; each carries
// `CLAUDE.md`'s `TODO(copy)` marker until the owner writes it, so the arm is
// visible and reviewable and nothing here invents a sentence. What is built
// and tested today is which key each arm reaches for.
//
// **Criteria 4 and 5 are built, and the two open questions behind them are
// ruled** (issue #96, answered by rulings 6a and 5c of 2026-09-08):
// "Discoverability Score" is the number's name on every surface that labels
// it, and this card is a **declared example on the reserved domain**, drawn
// as the approved set draws it — "without a source date or an example
// line", which is 5c amending REQ-098 c5. So the figures below are the
// set's own specimen and the written line #266 added to explain them is
// gone: the domain is reserved, the figures are its example, and no
// visitor's measurement and no invented number is on this screen.
//
// **Three arms, one screen** (UI-SPEC S9). The left panel is the request
// form, or the **sent** arm, or the **expired** arm; the accent panel never
// changes. Which arm renders is decided from state this file already had —
// the action's answer and the dead-link marker — so no arm costs a read, a
// branch on identity, or a millisecond another does not: REQ-098 c7's "that
// line and the time it takes are the same whatever the reason" holds
// because there is nothing here that could make them differ.
//
// **The screen root is a `Surface`** (ADR-093; DECISIONS 2026-09-02). One
// column at every band, which is what the screen is today: REQ-098's own
// non-goals leave "whether criteria 2 and 4 render in one column or two at
// any of ADR-093's three bands" to the design system, and criterion 4's
// card — the second column's only candidate — is not built. The build that
// lands it re-declares the medium and wide arms here.
"use client";

import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { use, useActionState, useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Input } from "@/ui/components/Input";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { Progress } from "@/ui/components/Progress";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";

/** The specimen the accent panel shows: the **reserved domain**, and the
 *  figures the owner's approved screen set draws on it (ruling 5c, which
 *  settles REQ-098's open question 2, and c5 with it). Not a placeholder,
 *  not a visitor's own domain, and not a number this file computed — the
 *  three things §9.4 refuses.
 *
 *  They were the report fixture's own 62 until 5c; the ruling is "as
 *  drawn", so they are the set's 47 now, and `tests/app/signin/` pins them
 *  against the approved HTML rather than against a fixture that is free to
 *  move for its own reasons. Constants, because this screen renders before
 *  there is a session, a scan or a store to read. */
const SPECIMEN_DOMAIN = "example.com";
const SPECIMEN_SCORE = 47;
/** REQ-004's own denominator — the score is out of one hundred. */
const SPECIMEN_MAX = 100;

/** The glass card's inverse pill. #298 omitted it — "+6 pts est." shown to
 *  a stranger would have been a number the product invented — and ruling 5c
 *  draws it: the whole card is a declared example on the reserved domain,
 *  so the pill is part of the example rather than a claim about anybody.
 *  REQ-098 c4 quotes it verbatim among the strings this screen carries, and
 *  it is a copy key like the rest. */

type SignInSearchParams = Partial<Record<typeof LINK_QUERY_KEY, string>>;

/** The one written line each answer reaches for (REQ-098 criteria 3 and 6;
 *  REQ-020 criterion 4). `none` is before any submission, when the screen
 *  answers nothing at all. */
const ANSWER_COPY_KEY = {
  none: undefined,
  invalid: "signin.address.invalid",
  sent: "signin.link_sent",
  payment_held: "signin.payment_held",
  no_account: "signin.no_account",
} as const satisfies Record<SignInState["answer"], CopyKey | undefined>;

/** REQ-098 criterion 7's arm. "Expired; spent … or never issued by this
 *  product" are one case with one line and one shape, "so someone holding a
 *  link that is not theirs learns nothing about whether the address it was
 *  issued for has an account": this screen therefore reads one marker and
 *  never a reason. The marker's spelling is an internal name (constitution
 *  rule 1.1), and since issue #35 it has one home —
 *  `src/lib/account/identity/addresses.ts`, which is also where the route
 *  that redeems a link reads it from when it sends a visitor here. */

/** This screen's own address, for the two controls that lead back to its
 *  form. Written once: a link to `/signin` with no query is what clears the
 *  dead-link marker, and it is the same value `src/middleware.ts` redirects
 *  to. */
const SIGN_IN_PATH = "/signin";

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain
 *  object (this file's own tests), on exactly the terms
 *  `src/app/(public)/page.tsx` established and for the same reason — it
 *  calls the `use()` hook conditionally on the caller's own shape, so it is
 *  named `use…`. */
function useSignInSearchParams(
  searchParams: Promise<SignInSearchParams> | SignInSearchParams | undefined
): SignInSearchParams {
  if (isPromise(searchParams)) return use(searchParams);
  return searchParams ?? {};
}

export default function SignInPage(props: {
  searchParams?: Promise<SignInSearchParams> | SignInSearchParams;
}): React.JSX.Element {
  const params = useSignInSearchParams(props.searchParams);
  const [state, formAction, pending] = useActionState(sendLink, SIGN_IN_INITIAL);
  const [typed, setTyped] = useState<string | undefined>(undefined);

  // Criterion 6's "they stay on the screen with what they typed intact":
  // what is in the field wins while they are typing, and what the action
  // carried back stands in for it on the pass where there is no client
  // runtime to have typed into.
  const value = typed ?? state.value;

  const deadLink = params[LINK_QUERY_KEY] === DEAD_LINK_MARKER;
  const answerKey = ANSWER_COPY_KEY[state.answer];
  const answer = answerKey === undefined ? undefined : copy(answerKey);
  // Which of the three the left panel is. An address that was answered —
  // whichever of REQ-020 c4's three answers it got — is the *sent* arm: one
  // shape, one control, and the answer's own line inside it, so the frame
  // says nothing the line does not (REQ-098 c3). A refusal of the value
  // itself keeps the form, because criterion 6 says they stay on the screen
  // with what they typed intact.
  const answered =
    state.answer === "sent" || state.answer === "payment_held" || state.answer === "no_account";

  return (
    // The card idiom's sign-in (issue #266): two panels, roughly 50/50, at
    // and above `--breakpoint-lg`. Left, the one action. Right, the accent
    // ground and the glass card. Ported from the endorsed preview code, not
    // redesigned.
    //
    // **The narrow arm is decided, not deferred** (tokens.md §9.4): below
    // `--breakpoint-lg` the panel does not sit beside the form, does not go
    // above it, and is not dropped — it follows the form in flow, full
    // width, on the same ground. The screen has exactly one primary action
    // and it must be the first thing on the screen at every width; the
    // panel carries no action and no route, so following the form costs the
    // customer nothing, while putting it above pushes an email field below
    // the fold on a phone.
    <Surface
      arms={{
        // The split declares its own layout at every band (issue #297), so
        // the surface gives it the container and nothing else — no measure
        // and no gutter. The idiom draws this screen as two full-height
        // panels meeting the viewport's edges; a gutter frames them, and a
        // two-column *grid* is not what divides them either: the split is a
        // flex row of its own below `--breakpoint-lg`, one column above it.
        compact: { kind: "declared", note: "the split is one column, panel after form" },
        medium: { kind: "declared", note: "the split is two full-height panels, edge to edge" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full rk-split">
        <div className="rk-split-form">
          <div className="rk-form-col">
            {/* The brand sits **inside the panel** on this route, and no
                public header stands above it (UI-SPEC S9): the screen is
                two full-height panels meeting the viewport's edges, and a
                bar across the top would be a third band carrying a control
                — on the one screen whose whole job is a single field. The
                group layout drops the header here; the mark is drawn
                here. */}
            <p className="rk-wordmark" data-testid="signin-brand">
              <span className="rk-wordmark-chip" aria-hidden />
              <span>{copy("chrome.wordmark")}</span>
            </p>

            {deadLink ? (
              /* REQ-098 c7's arm. The chip carries the warn tone — the one
                 thing that went wrong here is the link they are holding —
                 and the line is the same one whatever the reason, read from
                 a marker that carries none. */
              <>
                <span className="rk-head-chip" data-tone="warn" data-testid="signin-chip">
                  <Lock size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <h1>{copy("signin.expired.head")}</h1>
                <p className="rk-quiet">{copy("signin.link_dead")}</p>
                {/* "…and that they may ask for another": the control is the
                    way back to the field — a plain link to this screen
                    without the marker, so it works with no client runtime. */}
                <Btn
                  href={SIGN_IN_PATH}
                  label={copy("signin.expired.submit")}
                  variant="primary"
                  pill
                  block
                />
              </>
            ) : answered ? (
              /* The answered arm. The head and the resend word are the
                 owner's; the line between them is the answer's own — one of
                 REQ-020 c4's three — and the address is the one they typed,
                 echoed back, never one this screen looked up. */
              <>
                <span className="rk-head-chip" data-testid="signin-chip">
                  <Mail size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <h1>{copy("signin.sent.head")}</h1>
                <p className="rk-quiet" aria-live="polite">
                  {answer}
                </p>
                <p className="rk-quiet num">{copy("signin.sent.to", { address: value })}</p>
                <Btn href={SIGN_IN_PATH} label={copy("signin.sent.resend")} variant="tertiary" pill />
              </>
            ) : (
              <>
                <h1>{copy("signin.heading")}</h1>
                <p className="rk-quiet">{copy("signin.body")}</p>

                <form action={formAction}>
                  <Input
                    label={copy("signin.field.placeholder")}
                    placeholder={copy("signin.field.placeholder")}
                    name={EMAIL_FIELD}
                    value={value}
                    onChange={setTyped}
                  />
                  {/* The screen's one solid primary, full width — and the
                      only solid button on it. */}
                  <Btn
                    type="submit"
                    label={copy("signin.submit.label")}
                    variant="primary"
                    pill
                    block
                    inFlight={pending}
                  />
                </form>

                {/* Criterion 6's one written line, where the *value* was
                    refused. The answered arm above carries its own. */}
                <p aria-live="polite">{answer}</p>

                <p>
                  {copy("signin.new.prompt")} <Link href="/">{copy("signin.new.link")}</Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* The accent ground and the glass card. Every figure in it is the
            **reserved fixture account's** own — the same score
            `/scan/example.com` renders — and `signin.panel.specimen` is the
            line that says so. tokens.md §9.4 raised this and answered
            neither surface; #266 answers it: a labelled specimen, never an
            invented number, and never a stranger's real domain. */}
        <div className="rk-split-panel rk-accent-ground" data-testid="signin-panel">
          <div className="rk-panel-col">
            <h2 className="rk-on-accent-h1">{copy("signin.panel.heading")}</h2>
            <div className="rk-glass">
              <p className="rk-prov num">{SPECIMEN_DOMAIN}</p>
              {/* The idiom's glass card puts an inverse pill — `--ink` on
                  `--surface` — at the right of this row, drawn as "+6 pts
                  est." (issue #298). **It is omitted here, and that is the
                  ruling followed rather than a gap**: the pill shows the
                  specimen's measured delta where one exists, and the
                  reserved fixture's verdict carries a score and no previous
                  score, so there is no delta to show. A number in that pill
                  would be one the product invented and showed to a stranger,
                  which is what §9.4's whole question is about. The row keeps
                  its label alone until a measured delta exists. */}
              {/* The label — ruling 6a's name for the number — and the
                  pill, both quoted verbatim by REQ-098 c4 and both drawn by
                  ruling 5c. */}
              <div className="rk-between">
                <p>{copy("signin.panel.score-label")}</p>
                <span className="rk-pill-inverse num">{copy("signin.panel.delta")}</span>
              </div>
              <p className="rk-figure">
                <span className="rk-figure-big num">{SPECIMEN_SCORE}</span>
                <span className="rk-figure-of num">{`/${SPECIMEN_MAX}`}</span>
              </p>
              <Progress
                value={SPECIMEN_SCORE}
                max={SPECIMEN_MAX}
                onAccent
                label={copy("signin.panel.score-label")}
              />
              {/* One line under the bar, and no second one: 5c admits a
                  reserved-domain specimen "without a source date or an
                  example line". */}
              <p className="rk-quiet">{copy("signin.panel.line")}</p>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
