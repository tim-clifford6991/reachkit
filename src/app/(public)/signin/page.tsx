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
// **Criteria 4 and 5 are not built** — the "Discoverability Score" card.
// REQ-098's first two open questions are unruled: whether that is the
// product's name for the score on every surface, and whether the card shows
// a real customer's scan or a declared example on a reserved domain. Either
// answer changes what the card is; neither is the implementer's to pick.
// Named in the pull request.
//
// **The screen root is a `Surface`** (ADR-093; DECISIONS 2026-09-02). One
// column at every band, which is what the screen is today: REQ-098's own
// non-goals leave "whether criteria 2 and 4 render in one column or two at
// any of ADR-093's three bands" to the design system, and criterion 4's
// card — the second column's only candidate — is not built. The build that
// lands it re-declares the medium and wide arms here.
"use client";

import Link from "next/link";
import { use, useActionState, useState } from "react";
import { Alert } from "@/ui/components/Alert";
import { Btn } from "@/ui/components/Btn";
import { Input } from "@/ui/components/Input";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { Progress } from "@/ui/components/Progress";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";

/** The specimen the accent panel shows, and where every figure in it comes
 *  from: the **reserved fixture account**, whose report `/scan/example.com`
 *  renders. Not a placeholder and not a real visitor's domain — the two
 *  things `design/tokens.md` §9.4 refuses. `signin.panel.specimen` is the
 *  line that says so on the screen; these three are the data behind it.
 *
 *  Stated here as constants rather than read through the fixture module,
 *  because this screen must render before there is a session, a scan or a
 *  store to read, and a public page that reached the report's own fixture
 *  loader to draw a decoration would be a read nobody needs. The score is
 *  the fixture's own 62 (`_fixture/states.ts`), and `tests/app/signin/`
 *  pins the two against each other so they cannot drift. */
const SPECIMEN_DOMAIN = "example.com";
const SPECIMEN_SCORE = 62;
/** REQ-004's own denominator — the score is out of one hundred. */
const SPECIMEN_MAX = 100;

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

/** `Alert`'s tone token for that line — a style token, like `Btn`'s
 *  `variant`, never a sentence. */
const DEAD_LINK_TONE = "warn" as const;

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

  const deadLink =
    params[LINK_QUERY_KEY] === DEAD_LINK_MARKER ? copy("signin.link_dead") : undefined;
  const answerKey = ANSWER_COPY_KEY[state.answer];
  const answer = answerKey === undefined ? undefined : copy(answerKey);

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
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full rk-split">
        <div className="rk-split-form">
          <div className="rk-form-col">
            {deadLink === undefined ? null : <Alert tone={DEAD_LINK_TONE} message={deadLink} />}

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
              {/* The screen's one solid primary, full width — and the only
                  solid button on it. */}
              <Btn
                type="submit"
                label={copy("signin.submit.label")}
                variant="primary"
                pill
                block
                inFlight={pending}
              />
            </form>

            <p aria-live="polite">{answer}</p>

            <p>
              {copy("signin.new.prompt")} <Link href="/">{copy("signin.new.link")}</Link>
            </p>
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
              <p>{copy("signin.panel.score-label")}</p>
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
              <p className="rk-quiet">{copy("signin.panel.line")}</p>
              <p className="rk-quiet">{copy("signin.panel.specimen")}</p>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
