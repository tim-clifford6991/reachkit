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
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";

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
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* The padding is load-bearing, not decoration. `<body>` carries the
          UA's own margin and nothing else; without a padding edge here the
          heading's top margin collapses straight through `<main>` and
          `<body>`, moving `<body>`'s box down while Next's own
          `<next-route-announcer>` — appended after the app tree — stays
          where it was, i.e. below `<body>`'s bottom edge. The layout
          sweep's containment check reads that, correctly, as an element
          outside its containing block (ADR-093 decision 6 point 2). One
          padding edge ends the collapse, and gives the screen a margin at
          320px besides. */}
      <main className="p-4">
        {deadLink === undefined ? null : <Alert tone={DEAD_LINK_TONE} message={deadLink} />}

        <h1>{copy("signin.heading")}</h1>
        <p>{copy("signin.body")}</p>

        <form action={formAction}>
          <Input
            label={copy("signin.field.placeholder")}
            placeholder={copy("signin.field.placeholder")}
            name={EMAIL_FIELD}
            value={value}
            onChange={setTyped}
          />
          <Btn
            type="submit"
            label={copy("signin.submit.label")}
            variant="primary"
            inFlight={pending}
          />
        </form>

        <p aria-live="polite">{answer}</p>

        <p>
          {copy("signin.new.prompt")} <Link href="/">{copy("signin.new.link")}</Link>
        </p>
      </main>
    </Surface>
  );
}
