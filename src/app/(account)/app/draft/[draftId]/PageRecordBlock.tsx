// BUILD §4.6, §9 — what became of this page, on the page's own view.
//
// The address it is or was readable at, what ReachKit's one check saw, what
// the last unpublish call found, and REQ-060 criterion 4's line — the four
// facts `PageRecord` has carried since #215 and no surface rendered
// (issue #217).
//
// **The record decides; this reads.** Every choice below is already made in
// `src/lib/publish/record/`: which address label a page has earned is
// `addressOf`'s, which verification line it has is `verificationLine`'s,
// and whether criterion 4's line appears at all is `seoNoteOf`'s. This
// component holds no condition about liveness, asks nothing about the
// destination's kind, and picks no key. What it owns is the one thing that
// is presentation and not fact: which tone each standing wears.
//
// **A block, not a card.** It sits inside the draft view's own card,
// because it is what became of *this* page and not a second object on the
// screen. §2.2's component set is closed and this adds nothing to it: the
// rows are a label column and a value column, and the only registered
// component is `Badge`.
//
// **No row without a fact.** There is no blank value and no dash anywhere:
// a row the record has nothing for is not drawn. The address row is the
// exception that proves it — the never-made-live arm carries no `url` field
// at all, so what stands there is a sentence *in place of* an address,
// which is REQ-056 criterion 6's own construction.
//
// **Every sentence goes through `writtenLine`, not `copy`.** This renders
// on a route the customer reaches, and every key it names is `TODO(copy)`
// today; the shell's own `written.ts` (issue #9) states the argument in
// full — a screen that throws is worse in every way than a screen that
// omits a line nobody has written.
import type React from "react";
import { Badge } from "@/ui/components/Badge";
import type { Tone } from "@/ui/types";
import {
  unpublishedLine,
  verificationLine,
  type VerificationKind,
} from "@/lib/publish/record/lines";
import type { PageRecord } from "@/lib/publish/record";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";

/**
 * How each standing looks. The one thing on this screen that is
 * presentation rather than record, so it is the one thing decided here —
 * and it is total over `VerificationKind`, so an eighth standing is a
 * compile error rather than a line with no tone.
 *
 * **`page_not_found` warns and `could_not_confirm` does not**, which is the
 * only place the two differ to look at. They are two keys because they have
 * opposite consequences (ADR-085); the tone is what stops a reader taking
 * "ReachKit does not know" for "ReachKit found nothing there". Neither is
 * `bad`: §2.5 keeps red for the customer's problem being shown to them, and
 * a page ReachKit could not confirm is not yet one.
 */
const VERIFICATION_TONE: Readonly<Record<VerificationKind, Tone>> = Object.freeze({
  found: "ok",
  page_not_found: "warn",
  could_not_confirm: "neutral",
  not_yet: "neutral",
  due: "neutral",
  never_taken_down_first: "neutral",
  never_no_live_address: "neutral",
});

/** A label and its value. **The row is drawn whether or not the label's
 *  sentence has been written**: the label is the decoration and the value is
 *  the fact, so an unwritten label leaves an empty column and never takes
 *  the address or the outcome off the screen with it. */
function Row(p: {
  label: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-baseline gap-3">
      <span className="text-[length:var(--t-eyebrow)] font-bold uppercase tracking-[0.1em] opacity-60">
        {p.label}
      </span>
      <span className="flex min-w-0 flex-col gap-1">{p.children}</span>
    </div>
  );
}

export function PageRecordBlock(p: {
  record: PageRecord;
  /** The site-local zone every date this view states is expressed in —
   *  the draft view's own, so the record's dates and the page's cannot be
   *  read in two clocks. */
  timeZone: string;
}): React.JSX.Element {
  const { record } = p;
  const verification = verificationLine(record.verification);
  const title = writtenLine("record.title");

  return (
    <section className="flex flex-col gap-3">
      {title === null ? null : <h2 className="text-base font-bold">{title}</h2>}

      <Row label={writtenLine("record.label.address")}>
        {record.address.offered ? (
          <>
            <span>{writtenLine(record.address.label)}</span>
            {/* §2.3: an address is a code-like string and renders in the
                mono utility, like every other one on this screen. */}
            <a className="num min-w-0" href={record.address.url}>
              {record.address.url}
            </a>
          </>
        ) : (
          <span>{writtenLine(record.address.copy)}</span>
        )}
      </Row>

      {record.unpublishOutcome === null ? null : (
        <Row label={writtenLine("record.label.taken-down")}>
          <span>
            <Badge tone="neutral">{writtenLine(unpublishedLine(record.unpublishOutcome))}</Badge>
          </span>
        </Row>
      )}

      <Row label={writtenLine("record.label.checked")}>
        <span className="flex flex-wrap items-baseline gap-2">
          <Badge tone={VERIFICATION_TONE[verification.kind]}>{writtenLine(verification.copy)}</Badge>
          {verification.at === null ? null : (
            <span className="num text-[length:var(--t-eyebrow)] opacity-60">
              {formatDateTime(verification.at, p.timeZone)}
            </span>
          )}
        </span>
      </Row>

      {/* REQ-060 criterion 4's line, exactly where the record put it and on
          no other surface. It takes no tone: the customer's site had no SEO
          plugin to write the title and description into, which is a fact
          about their site and not a failure of their page — the page went
          out and is readable. */}
      {record.seoNote === null ? null : (
        <p className="text-xs opacity-70">{writtenLine(record.seoNote)}</p>
      )}
    </section>
  );
}
