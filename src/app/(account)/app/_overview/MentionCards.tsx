// SPEC §4 · §6 (2026-09-22, #1004) — *Also appearing for* and *Cited pages*,
// beneath the grid.
//
// Two daisyUI `card`s, each holding a daisyUI `list` — `docs/DESIGN.md`'s
// rule 1, with `list` on the 2026-09-20 allow-list. No chart: neither card
// is a series (one is a ranked list of questions, the other a ranked list
// of pages), so rule 2 does not apply and hand-rolled SVG is forbidden
// anyway. lucide at stroke 1.75, 16px in a row.
//
// **`.list-row` is the grid** (the trap `daisyui-prose-traps` records): its
// children are laid out by position, so each row's parts are wrapped in
// their own elements rather than left loose, and the growable ones carry
// `min-w-0`.
//
// **Nothing here can overflow, and nothing is clamped to hide it.** A
// question is prose: it wraps at its spaces and the row grows with it. A
// page address is a **value** — `.num`, which `src/ui/type.css` forbids
// breaking inside — so it cannot wrap, and ADR-093's rule applies instead:
// the *box* changes, and it sits in the `overflow-x-auto` container that
// rule names. Either way no figure is clamped and no text is cut off, which
// is `docs/DESIGN.md`'s no-overflow rule. The only mono-face values are the
// counts and that address, which is what JetBrains Mono is reserved for.
//
// **Every sentence is the registry's.** The one thing drawn as data is the
// question itself and the page address: both are measurements — what a
// buyer asked, and an address on the customer's own site — shown inside a
// frame the registry wrote, exactly as the Search tab already draws a
// search. Neither is generated text: no model of ours composed them.
//
// **Three things neither card draws**: a rank position, anything readable
// as sentiment, and the answer's own prose. §4's 2026-09-20 rule closes the
// tab on the first two; the third has no member on the model to render.
import type React from "react";
import { FileText, MessageCircleQuestion } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { formatCount, formatMonthDay } from "./present";
import { MENTIONS_WINDOW_WEEKS, type MentionsModel } from "./mentions-model";

/** One card's shell: its head, the line under it, and whatever it holds.
 *  The same `card card-border` the grid above uses, so the three read as
 *  one stack rather than as three visual ideas. */
function Card(p: {
  testId: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <h2 className="card-title text-base!">{p.title}</h2>
        <p className="max-w-prose text-sm text-base-content/70">{p.lead}</p>
        {p.children}
      </div>
    </section>
  );
}

/** The line that says how far back both cards look. `/70` and not `/60`:
 *  the axe floor (#946) fails a thinner ink on this ground. */
function Window(): React.JSX.Element {
  return (
    <p className="max-w-prose text-xs text-base-content/70" data-testid="mentions-window">
      {copy("overview.mentions.window", { weeks: formatCount(MENTIONS_WINDOW_WEEKS) })}
    </p>
  );
}

export function MentionCards(p: {
  model: MentionsModel;
  /** The customer's own zone, so "first seen" is stated on their calendar
   *  and not the server's. */
  timeZone: string;
}): React.JSX.Element | null {
  // A site nobody has queried draws no card at all. Not an empty state: an
  // empty card is a claim that there was something to measure, and there
  // has not been a pass that bought this yet.
  if (p.model.kind === "never_queried") return null;

  if (p.model.kind === "unread" || p.model.kind === "zero") {
    // One card, one written line. A measured zero and a window nobody could
    // read are different sentences and never the same one: the first says
    // the engines named nobody, the second says we did not look.
    // One week is its own sentence. A slot cannot write "1 weeks" out of a
    // plural, and the proof at 390 is where that read back.
    const one = p.model.weeks === 1;
    const line =
      p.model.kind === "zero"
        ? one
          ? copy("overview.mentions.zero.one-week")
          : copy("overview.mentions.zero", { weeks: formatCount(p.model.weeks) })
        : one
          ? copy("overview.mentions.unread.one-week")
          : copy("overview.mentions.unread", { weeks: formatCount(p.model.weeks) });
    return (
      <Card
        testId="mentions-also"
        title={copy("overview.mentions.also.title")}
        lead={copy("overview.mentions.also.lead")}
      >
        <p className="max-w-prose text-sm text-base-content/70" data-testid="mentions-state">
          {line}
        </p>
      </Card>
    );
  }

  const { alsoAppearing, alsoAppearingTotal, citedPages } = p.model;

  return (
    <>
      <Card
        testId="mentions-also"
        title={copy("overview.mentions.also.title")}
        lead={copy("overview.mentions.also.lead")}
      >
        <Window />
        <ul className="list min-w-0" aria-label={copy("overview.mentions.also.label")}>
          {alsoAppearing.map((row) => (
            <li className="list-row min-w-0 items-start px-0" key={row.question} data-testid="mentions-also-row">
              <MessageCircleQuestion
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="mt-1 shrink-0 text-base-content/70"
              />
              {/* `list-col-grow` is daisyUI's own "this is the column that
                  takes the room"; the question wraps inside it. */}
              <div className="list-col-grow flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 text-sm font-semibold">{row.question}</span>
                <span className="min-w-0 text-xs text-base-content/70">
                  {copy("overview.mentions.also.first-seen", {
                    on: formatMonthDay(row.firstSeenAt, p.timeZone),
                  })}
                </span>
                {row.engines.length === 0 ? null : (
                  <span className="min-w-0 text-xs text-base-content/70" data-testid="mentions-engines">
                    {copy("overview.mentions.engines", {
                      engines: row.engines.map((engine) => copy(ENGINE_LABEL[engine])).join(" · "),
                    })}
                  </span>
                )}
              </div>
              {/* The demand figure, never clamped — the row grows instead.
                  A question the vendor could not size says so in words
                  rather than showing a zero. */}
              <span className="min-w-0 shrink-0 text-xs text-base-content/70" data-testid="mentions-asked">
                {row.aiSearchVolume === null ? (
                  copy("overview.mentions.also.unsized")
                ) : (
                  <span className="num">
                    {copy("overview.mentions.also.asked", {
                      count: formatCount(row.aiSearchVolume),
                    })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {/* How much of the list is on screen. Drawn only where the top-12
            cut actually hid something, so a short list is not told it is
            short. */}
        {alsoAppearingTotal > alsoAppearing.length ? (
          <p className="num min-w-0 text-xs text-base-content/70" data-testid="mentions-also-showing">
            {copy("overview.mentions.also.showing", {
              shown: formatCount(alsoAppearing.length),
              total: formatCount(alsoAppearingTotal),
            })}
          </p>
        ) : null}
      </Card>

      <Card
        testId="mentions-cited"
        title={copy("overview.mentions.cited.title")}
        lead={copy("overview.mentions.cited.lead")}
      >
        <Window />
        {citedPages.length === 0 ? (
          // The engines named the site but quoted no page of theirs. A real
          // state, and a different one from having no answers at all.
          <p className="max-w-prose text-sm text-base-content/70" data-testid="mentions-cited-none">
            {copy("overview.mentions.cited.none")}
          </p>
        ) : (
          <ul className="list min-w-0" aria-label={copy("overview.mentions.cited.label")}>
            {citedPages.map((page) => (
              <li className="list-row min-w-0 items-start px-0" key={page.url} data-testid="mentions-cited-row">
                <FileText
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className="mt-1 shrink-0 text-base-content/70"
                />
                {/* **A declared scroll container, because the value must
                    not be rewritten.** The address is `.num`, and
                    `src/ui/type.css` bans every break inside a value —
                    `overflow-wrap`, `word-break` and `white-space` all say
                    so, unlayered, so no Tailwind utility can undo it: "a
                    customer compares the domain on the screen with the one
                    they typed, so a mid-word break makes those two
                    different strings". ADR-093 decides what happens
                    instead — the **box** changes — and this is that box,
                    in the same three classes `AddressLine` and the
                    registered `Table` carry (`min-w-0`, because a scroll
                    container that cannot shrink never scrolls).
                    The proof at 390 is what found it: `break-words` and
                    then `wrap-anywhere` both computed to `normal` here,
                    and a 368px address sat in a 199px grid track and
                    pushed the whole page into a horizontal scroll. */}
                <div className="list-col-grow min-w-0 max-w-full overflow-x-auto">
                  {/* The path is what is shown; the whole address is what
                      the link goes to. The domain is the customer's own and
                      is identical on every row, so showing it four times
                      spends the width that tells the four pages apart. */}
                  <a
                    href={page.url}
                    className="link link-primary num text-sm"
                    data-testid="mentions-cited-url"
                  >
                    {page.label}
                  </a>
                </div>
                <span className="num min-w-0 shrink-0 text-xs text-base-content/70">
                  {page.questions === 1
                    ? copy("overview.mentions.cited.one-question")
                    : copy("overview.mentions.cited.questions", {
                        count: formatCount(page.questions),
                      })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
