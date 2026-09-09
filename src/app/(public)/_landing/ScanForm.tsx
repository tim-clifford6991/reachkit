// BUILD §3, REQ-001 c1 — the landing's one field and one control.
// src/app/(public)/_landing/ScanForm.tsx
//
// Extracted from `page.tsx` by issue #266, unchanged in behaviour. The page
// became a Server Component so the hero's specimen can be the report's own
// component over the reserved fixture (the owner's 2026-09-02 ruling: "an
// enticing image/component giving them an immediate feel for what the app is
// and looks like"), and a Server Component cannot carry `onSubmit`. So the
// interactive half moved here whole: the same single file carrying both the
// no-JavaScript and the JavaScript path, with the same `searchParams`
// reading convention and the same one named field.
//
// **REQ-001 c1 is untouched by the move and by #266's composition**: this is
// the only text input and the only submit control in the document, and the
// sections the page adds around it are prose, links and one component — no
// second field, no selector, no toggle.
"use client";

import { use, useState, type FormEvent } from "react";
import { Input } from "@/ui/components/Input";
import { Btn } from "@/ui/components/Btn";
import { copy } from "@/lib/presentation/copy";
import type { DomainProblem } from "@/lib/scan/domain";
import type { StartScanResponse } from "@/app/api/scan/route";

type LandingSearchParams = { problem?: string; value?: string };

// The five `DomainProblem` handles (`src/lib/scan/domain.ts`, WO-051) and
// the one landing-copy key each names, per this WO's `rests-on` row: "one
// written line per DomainProblem." No sixth or fourth value exists; a
// value outside this list is treated as no problem at all (Step 4/5: only
// a value this page recognises re-renders the line).
const PROBLEM_COPY_KEY = {
  empty: "landing.problem.empty",
  not_a_hostname: "landing.problem.not-a-hostname",
  ip_literal: "landing.problem.ip-literal",
  no_public_suffix: "landing.problem.no-public-suffix",
  too_long: "landing.problem.too-long",
} as const satisfies Record<DomainProblem, string>;

function isDomainProblem(value: string | undefined): value is DomainProblem {
  return value !== undefined && Object.prototype.hasOwnProperty.call(PROBLEM_COPY_KEY, value);
}

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain
 *  object (this file's own tests, and every no-JS SSR pass) without
 *  suspending either caller. Named `use…` (not `readSearchParams`) because
 *  it calls the `use()` hook conditionally on the caller's own shape —
 *  `eslint-plugin-react-hooks` requires a hook-calling function's name to
 *  say so. */
function useLandingSearchParams(
  searchParams: Promise<LandingSearchParams> | LandingSearchParams | undefined
): LandingSearchParams {
  if (isPromise(searchParams)) return use(searchParams);
  return searchParams ?? {};
}

export function ScanForm(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
  /** The submit control's label, where the screen is not the landing.
   *  Optional and defaulted to REQ-001 c1's own, so `/`'s call site is
   *  unchanged: S8 draws the same field and the same action under a
   *  different word ("Scan it"), and a second copy of this form would be a
   *  second place the no-JavaScript path, the five refusal lines and the
   *  one named field live. */
  submitLabel?: string;
}): React.JSX.Element {
  const initial = useLandingSearchParams(props.searchParams);
  const initialProblem = isDomainProblem(initial.problem) ? initial.problem : undefined;

  const [value, setValue] = useState(initial.value ?? "");
  const [problem, setProblem] = useState<DomainProblem | undefined>(initialProblem);
  const [submitting, setSubmitting] = useState(false);

  // `## Steps` step 4: with JavaScript, post JSON and navigate to
  // `location` on `ok: true`; on `ok: false`, re-render in place with the
  // value intact and the problem's written line. `preventDefault()` is
  // what keeps the browser from also doing its own native submission —
  // without it (no client runtime at all), this handler never runs and
  // the plain `<form>` below carries the no-JS path instead (Step 5).
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const body = (await response.json()) as StartScanResponse;
      if (body.ok) {
        window.location.assign(body.location);
        return;
      }
      setProblem(body.problem);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // The idiom's hero form: the field and the control on one row, the field
    // taking `--w-form` and the control sitting at its foot. On the accent
    // ground the solid primary inverts — `--on-accent` fill, `--accent`
    // label — because a solid accent button on an accent ground has no edge
    // (tokens.md §9.1). It is still the screen's ONE solid primary: the
    // master's ruling on the #266 mockup is one per screen, and on `/` this
    // is it, which is why the header shows only the sign-in link here.
    <form action="/api/scan" method="post" onSubmit={handleSubmit} className="rk-hero-form">
      {problem ? (
        <Input
          label={copy("landing.field.label")}
          labelHidden
          placeholder={copy("landing.field.placeholder")}
          name="value"
          value={value}
          onChange={setValue}
          invalid
          invalidMessage={copy(PROBLEM_COPY_KEY[problem])}
        />
      ) : (
        <Input
          label={copy("landing.field.label")}
          labelHidden
          placeholder={copy("landing.field.placeholder")}
          name="value"
          value={value}
          onChange={setValue}
        />
      )}
      {/* The screen's one submit control, and the hero's own solid primary
          (ruling 2b gives this page two — this one and the header's). The
          approved set draws it beside the field on one row, on the page's
          own `--bg`: the accent hero is gone with the set, and with it the
          `on-accent` inversion this control used to take. */}
      <Btn
        type="submit"
        label={props.submitLabel ?? copy("landing.submit.label")}
        variant="primary"
        pill
        inFlight={submitting}
      />
    </form>
  );
}
