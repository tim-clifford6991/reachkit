// SPEC §7 (2026-09-20, #908) · issue #931 — the page as it publishes.
//
// "The review screen shows the whole page **exactly as readers and search
// engines receive it**, in the customer's own page frame."
//
// **One serialiser, and this file is the proof of it.** The body here is
// built by the same three calls the hosted route makes, with the same class
// map and inside the same `prose`:
//
//     parseMarkdown(bodyMd) → markPassage(…) → toHtml(…, HOSTED_BODY_CLASSES)
//
// `HOSTED_BODY_CLASSES` is imported from the hosted page's own module rather
// than copied, so there is no second table to keep in step; and the classes
// it does not set are `prose`'s, in this theme's colours, exactly as they
// are on the customer's domain. A reviewer looking at this screen is looking
// at the bytes a reader will get — the table that scrolls inside its own
// box, the short-answer box, the marked passage. A second renderer here is
// what `markdown.ts`'s own header forbids, and it is also what would make
// this screen a promise rather than a preview.
//
// It is also why SPEC §7's related guides need nothing here: `guidesBlock()`
// mints that block in code and nothing on `main` calls it yet, so no body
// serves one on either surface today — and the day the writer does, this
// screen draws it because it is the same call.
//
// **`DRAFT_BODY_CLASSES` is deliberately not used.** That map is the dense,
// explicit one the editor's preview needs, where the body sits inside a card
// among other cards and a `prose` measure would fight it. Here the body is
// the *page*, so the page's own dressing is the right one.
//
// **The frame carries their name and their address and no mark of ours**
// (#931). daisyUI `mockup-browser`, which `docs/DESIGN.md` admits by name
// since 2026-09-20 — the address bar is the page's own address, and inside
// it the publisher line, the category, the headline and the date the hosted
// page draws, in the same order. Nothing of ReachKit's appears inside the
// frame: a mark of ours on a page about to go on a stranger's domain is the
// one thing the frame exists to show is absent.
//
// **It is read-only.** No control, no field, no action — the actions are the
// screen's chrome around it (`DecidePanel`). SPEC §7's own switch, which
// labels each section with its role, is not here and cannot be: a section's
// `SectionRole` is the outline's, and the outline is not stored on the
// draft. See this PR's body.
//
// **Nothing here scrolls the document sideways.** The two boxes that scroll
// — a table and a fence — scroll inside themselves, which is the serialiser's
// own doing (#973 gives both `tabindex`, `role` and an `aria-label`, so each
// is reachable from a keyboard as #962 requires). The frame is `min-w-0` at
// every level so a long address or a wide table moves its own box and never
// the screen.
import type React from "react";
import { HOSTED_BODY_CLASSES } from "@/app/(hosted)/hosted-page/body-classes";
import { Clock } from "lucide-react";
import {
  markPassage,
  parseMarkdown,
  toHtml,
} from "@/lib/publish/render/markdown";
import type { Grounded, Publisher } from "./model";

/** The page's own address, as a browser bar shows it: the host and the path,
 *  with the scheme dropped. **The whole of it**, so the customer reads what
 *  a reader will read — `.num` keeps it in the mono face, and where it does
 *  not fit the bar the box scrolls (below) rather than the value being cut
 *  or broken. */
function addressOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

export function PublishedPageView(p: {
  title: string;
  bodyMd: string;
  /** Only the two members the mark is placed from. The address and the date
   *  the fact was read are the *source line*'s (below), which the caller
   *  passes as a node — so this component cannot draw a citation of its
   *  own and cannot need one to render the body. */
  grounded: Pick<Grounded, "present" | "passage">;
  publisher: Publisher;
  /** REQ-045 criterion 2's source line — the address the fact was read from
   *  and the date it was read — placed **inside the article, at its foot**,
   *  which is where the hosted route puts its own (`page.tsx`: the same node
   *  after the same body). It is the page's citation of its source, so a
   *  reader gets it too; it is not ours, and the one line that is ours (the
   *  generated-content label) stays outside the frame.
   *
   *  #355 put it under the paragraph carrying the mark, on a screen that had
   *  no page frame to put it in. Following the hosted page costs that
   *  adjacency and buys the thing #931 asks for: the article a reviewer
   *  approves is the article a reader gets. See this PR's body. */
  source?: React.ReactNode;
  /** The line above the frame: what the frame is, and when it goes live.
   *  A live page has none. */
  caption?: string;
}): React.JSX.Element {
  // The one Markdown renderer, which escapes every text node on the way out
  // — so this string is safe to set as HTML by construction rather than by a
  // sanitiser somebody has to remember to call.
  const blocks = parseMarkdown(p.bodyMd);
  // `markPassage` is the same call the hosted page makes, so the fact the
  // customer approved and the one a visitor reads are marked alike. A
  // passage no longer in the text marks nothing rather than the nearest
  // thing to it.
  const body = toHtml(
    p.grounded.present && p.grounded.passage !== ""
      ? markPassage(blocks, p.grounded.passage).blocks
      : blocks,
    HOSTED_BODY_CLASSES,
  );

  return (
    <section
      className="flex min-w-0 flex-col gap-2"
      data-testid="published-view"
    >
      {p.caption === undefined ? null : (
        <p
          className="flex items-center gap-1.5 text-sm text-base-content/70 wrap-anywhere"
          data-testid="published-view-lead"
        >
          <Clock size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
          {p.caption}
        </p>
      )}

      <div className="mockup-browser border-base-300 bg-base-200 min-w-0 border">
        <div className="mockup-browser-toolbar min-w-0">
          {/* The address as a browser shows it, and not a link: there is
              nowhere to send a reviewer — the page is not live yet, and on a
              live page the record's own block is what offers the address. */}
          {/* `w-full`: `.input` is `width: clamp(3rem, 20rem, 100%)`, so left to
              itself the bar stays 320px wide and scrolls an address inside it
              on a 1280 screen with room to spare. A browser's bar is as wide
              as the browser. */}
          <span className="input min-w-0 w-full items-center">
            {/* **The box scrolls; the address is never rewritten to fit
                it.** An address is a value, and `src/ui/type.css` bans
                every break inside one — "a domain is a value and is never
                wrapped mid-word" — so `wrap-anywhere` here would be a
                no-op and `truncate` would be a value cut in half, which
                `tests/ui/layout/checks.ts` fails whether the box is
                allow-listed or not. The rule the sheet names instead is
                ADR-093's: the *box* changes, with an `overflow-x-auto`
                wrap. `AddressLine` and the scan's free-page row are the
                same two lines, and a real browser bar scrolls its address
                for the same reason.
                `tabIndex` because a scroller a mouse can reach and a
                keyboard cannot is an axe failure of its own
                (`scrollable-region-focusable`). */}
            <span
              className="num min-w-0 max-w-full overflow-x-auto"
              data-testid="published-view-address"
              tabIndex={0}
            >
              {addressOf(p.publisher.url)}
            </span>
          </span>
        </div>

        <div className="bg-base-100 min-w-0 px-4 py-8 sm:px-8">
          <article
            className="mx-auto w-full max-w-2xl min-w-0"
            data-testid="published-view-article"
          >
            {/* The publisher line the hosted page draws: their mark and
                their name. The dot is a neutral ink, never the product's
                primary — our colour on their page would be our branding on
                their domain. */}
            <span className="text-base-content mb-3 flex min-w-0 items-center gap-2 font-extrabold tracking-tight">
              <span
                className="bg-base-content size-4 shrink-0 rounded-full"
                aria-hidden
              />
              <span className="min-w-0 wrap-anywhere">{p.publisher.name}</span>
            </span>

            <h1 className="text-base-content my-3 text-4xl font-extrabold tracking-tight text-balance">
              {p.title}
            </h1>

            {/* **No byline date, and that is the one thing this frame leaves
                out on purpose.** The hosted line reads "published {date} · by
                {publisher}" off the `publications` row, and a page in review
                has no such row: the screen holds the day it was *written* and,
                under autopilot, the day the veto window closes — neither of
                which is a publication date. Writing either into that line
                would put the only invented fact on the page into the frame
                whose job is to show there is none. The date it will carry is
                the day it goes out, which the rail states in its own words.
                See this PR's body. */}

            <hr className="border-base-300 my-6" />

            {/* SPEC §7 (2026-09-20, #929/#973): `prose` — the article
                typography `docs/DESIGN.md` admits for exactly this, and the
                same declaration the hosted route uses. `max-w-none` because
                the measure is the article's above. */}
            {/* `draft-body` — the same name this screen's body has always
                carried, because this *is* the body: the whole page, never
                truncated (c1), with §8's recorded passage marked where it is
                still in the text (c8). Every assertion written against that
                name is about this element now, which is why it keeps it
                rather than being renamed beside a new one. */}
            <div
              className="prose prose-lg min-w-0 max-w-none"
              data-testid="draft-body"
              dangerouslySetInnerHTML={{ __html: body }}
            />
            {p.source}
          </article>
        </div>
      </div>
    </section>
  );
}
