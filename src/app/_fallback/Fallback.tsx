// UI-SPEC S8 — the not-found and error screen, one shape for both.
// src/app/_fallback/Fallback.tsx
//
// S8, whole: "Eyebrow 404 · 'There is no page at this address.' · 'Reports
// live at reachkit.app/scan/yourdomain.com' · scan field + solid 'Scan it'
// · footer. The error page is the same shape with one written line."
//
// **One shape, five mounts, one file.** `(public)` and `(account)` each
// carry a `not-found.tsx` and an `error.tsx`, and `src/app/global-error.tsx`
// is the fifth; what differs between them is the line and the one control,
// which is what these two components take. The eyebrow and the heading they
// read themselves — those are the same words on a public address and inside
// the app, and a key read in four files is four places to get it wrong. A
// second copy of the shape would be a second place the set's drawing lives,
// and the two would drift the first time either moved.
//
// Two exports and not one prop: a mount says which page it is by calling
// `NotFoundScreen` or `ErrorScreen`, so `not-found` and `error` are written
// once each, here, rather than as a string in five route files.
//
// **It lives outside both groups because it belongs to both.** A
// `_`-prefixed directory is private to the router (Next's own convention),
// so nothing here is a route; and `(account)` reaching into
// `(public)/_chrome` for a screen shape would put the app's 404 inside the
// public shell's tree.
//
// **The screen root is a `Surface`** (ADR-093 decision 6; the sweep asserts
// exactly one `[data-surface]` per document). One column at every band: the
// screen is an eyebrow, a heading, a line and one control, and there is
// nothing to put beside them. It is the root on every mount — `(public)`'s
// group layout renders chrome and no surface, `(account)`'s is the setup
// gate and renders neither, and `global-error` replaces the root layout
// altogether.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Surface } from "@/ui/layout";
import type { Arm, Band } from "@/ui/layout";

/** The two pages S8 draws. A closed union: a third fallback screen has to
 *  be added here, with its own two keys, rather than arriving as a pair of
 *  strings some route passed in. */
type FallbackKind = "not-found" | "error";

/** What a mount supplies. The eyebrow and the heading are not on it: those
 *  two are the same words on a public address and inside the app, so the
 *  screen reads them itself. */
interface FallbackProps {
  /** One written line, as an element: S8's public line names an address and
   *  the set draws it in the mono face, so the line is composed by its
   *  caller rather than handed over as a string. */
  line: React.ReactNode;
  /** The screen's one control — the scan field on a public address, the
   *  quiet way back inside the app. */
  action: React.ReactNode;
  testId: string;
}

/** Which two sentences each kind reads, and whether the eyebrow is a
 *  numeral. `404` is one — §2's rule is that every numeral is set in
 *  JetBrains Mono, and `.num` is the one class that binds the face — while
 *  the error page's eyebrow is words and stays in the UI family. */
const HEAD: Readonly<
  Record<FallbackKind, { eyebrow: CopyKey; heading: CopyKey; numeral: boolean }>
> = Object.freeze({
  "not-found": {
    eyebrow: "chrome.notfound.eyebrow",
    heading: "chrome.notfound.heading",
    numeral: true,
  },
  error: {
    eyebrow: "chrome.error.eyebrow",
    heading: "chrome.error.heading",
    numeral: false,
  },
});

const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "same-as-below" },
  wide: { kind: "same-as-below" },
} as const satisfies Record<Band, Arm>;

/** S8's shape, for one of the two kinds. Not exported: a mount names the
 *  page it is by calling `NotFoundScreen` or `ErrorScreen`, so no route
 *  file spells the kind as a string. */
function Fallback(p: FallbackProps & { kind: FallbackKind }): React.JSX.Element {
  const head = HEAD[p.kind];
  return (
    <Surface arms={ARMS}>
      <main className="rk-fallback" data-testid={p.testId}>
        <p className={head.numeral ? "eyebrow num" : "eyebrow"}>{copy(head.eyebrow)}</p>
        {/* The set draws the h1 at its display weight; the size is the
            ruled scale's, bound to the element in `src/ui/type.css`, which
            is why `.rk-hero-h` carries no size of its own. */}
        <h1 className="rk-hero-h">{copy(head.heading)}</h1>
        {p.line}
        {p.action}
      </main>
    </Surface>
  );
}

/** The two kinds, bound to names: a JSX attribute holding a bare string is
 *  presumed product voice by the copy sweep, and it is right to — these are
 *  internal handles, and this is where they are written down. */
const NOT_FOUND: FallbackKind = "not-found";
const ERROR: FallbackKind = "error";

/** "Eyebrow 404 · There is no page at this address." */
export function NotFoundScreen(p: FallbackProps): React.JSX.Element {
  return <Fallback kind={NOT_FOUND} {...p} />;
}

/** "The error page is the same shape with one written line." */
export function ErrorScreen(p: FallbackProps): React.JSX.Element {
  return <Fallback kind={ERROR} {...p} />;
}
