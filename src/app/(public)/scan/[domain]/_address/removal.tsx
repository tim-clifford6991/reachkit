// src/app/(public)/scan/[domain]/_address/removal.tsx — BUILD §4.1, REQ-002,
// ADR-002 (carries WO-067's file plan, which WO-282 superseded)
//
// Removal on written request, rendered. Two views and one response shape,
// over the three copy keys the owner ruled on 2026-09-04
// (`src/lib/presentation/copy/keys/report.ts`):
//
//   `removal.address`         the one address, written once, nowhere else
//   `removal.line.on-report`  REQ-002 c1, at the foot of every report
//   `removal.line.removed`    REQ-002 c3, the whole of a removed address
//
// **One address, from one key.** `removalAddress()` below is the single
// call site of `removal.address` in the whole product, and both views read
// it. The address on a live report and the address on the removed line can
// therefore never differ — REQ-002 c3 requires the removed line to name
// "the address criterion 1 names", and here that is not a convention to
// keep but the same string, resolved once.
// `tests/app/scan-address/removal.test.tsx` asserts the invariant that
// makes that true: the key has one declaration in the registry, every
// consumer resolves it through `copy()`/`COPY`, this module resolves it at
// one call site, and the address itself appears as a literal nowhere in
// `src/` outside the copy registry. (It does not count *files* mentioning
// the key — prose may cite it, and a citation resolves nothing.)
//
// **No control, no route back** (REQ-001 c18, REQ-002 c3): `RemovedView`
// renders one written line and nothing else — no button, no link, no
// form, no field, no report content, no score, no band. The one way back
// is a second written request to the same address, which is a sentence,
// not a control. Its own suite enumerates every interactive element in
// the rendered subtree and asserts there are none.
//
// **Reads nothing about the visitor.** REQ-002 c1's address must be
// "readable by a visitor with no account, session, or payment", so neither
// view takes a session, reads a cookie or a header, or branches on tier —
// there is nothing here to branch on.
//
// **The status and the headers** (`REMOVED_RESPONSE_INIT`). The owner
// ruled on 2026-09-05 (#28) that a blocked domain's report address serves
// `410 Gone`; the number is pinned as `REPORT_REMOVED_STATUS`. This module
// exposes the whole `ResponseInit` rather than the number alone so the
// route that eventually serves this arm carries no policy of its own:
// `noindex` (ADR-002 — report pages are noindex forever, and a removed one
// most of all) and `no-store` travel with the status, and the same three
// facts cannot drift apart across two files. **Nothing calls it yet**: the
// report route and the `AddressState` switch that would reach it are
// issue #25's, and this arm is deliberately built where that switch will
// find it rather than forked into a route of its own — a `page.tsx` cannot
// return 410 in any case (Next 16 offers `notFound`/`forbidden`/
// `unauthorized` and no `gone`).
import type React from "react";
import { REPORT_REMOVED_STATUS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { Surface } from "@/ui/layout";

/** The one call site of `removal.address` in the product. Never composed
 *  from parts, never templated from a domain, never read from `env`. */
function removalAddress(): string {
  return copy("removal.address");
}

/** REQ-002 c1 — "Given any report, when it renders, then it names in
 *  writing the address to which a request to remove the report about that
 *  domain is sent". Sits at the foot of every report; takes no props,
 *  because the address does not vary by domain, visitor or tier. */
export function RemovalAddressLine(): React.JSX.Element {
  // The set's `.prov`, centred under the pricing card (S2, issue #505):
  // mono, `--t-explain`, the quiet ink.
  return (
    <p className="rk-prov-line rk-center">
      {copy("removal.line.on-report", { address: removalAddress() })}
    </p>
  );
}

/** REQ-002 c3 — the entire body a removed domain's report address serves:
 *  one written line saying the report was removed at the site owner's
 *  request and naming the address that would bring it back. A screen root,
 *  so it declares its own three band arms (ADR-093); one column at every
 *  band, because one line is one column at any width. */
export function RemovedView(p: { domain: CanonicalDomain }): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main>
        <p>{copy("removal.line.removed", { domain: p.domain, address: removalAddress() })}</p>
      </main>
    </Surface>
  );
}

/**
 * The whole body a removed address serves, as one HTML document.
 *
 * **Why a string and not `RemovedView`.** The status is the point of this
 * arm (`410 Gone`, owner ruling 2026-09-05) and only a route handler can
 * set one; Next refuses `react-dom/server` inside the app router, so a
 * route handler cannot render a component. The document is therefore
 * written out here — in the same module, beside the view, reading the same
 * two copy keys through the same `removalAddress()` call site, so the two
 * forms cannot say different things.
 *
 * It carries no stylesheet, and that is the trade the ruling forces: a
 * styled render would be a `page.tsx`, and a `page.tsx` answers 200. One
 * written line at the right status beats a well-set one at the wrong one.
 * `RemovedView` above still renders the styled arm wherever a page owns
 * the response — the fixture preview of this state on `*.example.com`.
 *
 * No control, no link, no form, no report content: the same promise the
 * component keeps, and its own suite enumerates the markup to prove it.
 */
export function removedDocument(domain: CanonicalDomain): string {
  const line = copy("removal.line.removed", { domain, address: removalAddress() });
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    "</head>",
    `<body><main><p>${escapeHtml(line)}</p></main></body>`,
    "</html>",
  ].join("");
}

/** The line is the owner's sentence and the domain is a visitor-supplied
 *  segment that has been through `parseDomain`; neither should be able to
 *  close a tag, and this is the one place either becomes markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The status, the robots directive and the cache policy a removed
 *  address is served with, as one value (see this file's header). ADR-002:
 *  report pages are `noindex` forever and in no sitemap. */
export const REMOVED_RESPONSE_INIT: ResponseInit = Object.freeze({
  status: REPORT_REMOVED_STATUS,
  headers: Object.freeze({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  }),
});
