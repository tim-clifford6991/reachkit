// A teardown's own parts: the sketch of the page it read, the four numbered
// reads with what each draws, and the list of what is on the page. daisyUI
// classes in place, greyscale, no logo and no brand colour.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { TEARDOWN_PARTS, type SketchMark, type TeardownSection } from "./types";
import { BODY, CARD } from "./parts";

const SMALL = "text-base-content/70 text-sm";
const EYEBROW = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const FRAME = "mockup-browser border-base-300 bg-base-200 min-w-0 border";
const TOOLS = ["A", "B", "C"] as const;

/** A greyscale wireframe of another company's page, numbered where the
 *  article points, with the page's own words; what each number marks is
 *  listed under it. */
export function Sketch(p: { domain: string; marks: readonly SketchMark[]; caption: string }): React.JSX.Element {
  return (
    <figure className="flex min-w-0 flex-col gap-3" data-testid="teardown-sketch">
      <div className={FRAME}>
        <div className="mockup-browser-toolbar">
          <div className="input min-w-0 truncate font-mono text-xs">{p.domain}</div>
        </div>
        <ol className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
          {p.marks.map((mark, i) => (
            <li key={mark.title} className="flex min-w-0 flex-col gap-3">
              {mark.lower === true ? <p className={`${SMALL} text-center`}>{copy("teardowns.sketch.lower")}</p> : null}
              <div className="flex min-w-0 items-start gap-3">
                <span className="badge badge-outline badge-sm shrink-0">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  {mark.quotes.map((quote) => (
                    <p key={quote} className="break-words">
                      <q>{quote}</q>
                    </p>
                  ))}
                  {mark.shows === undefined ? null : (
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {mark.shows.map((label) => (
                        <span key={label} className="badge badge-ghost h-auto max-w-full break-words">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ol className={`${CARD} card-body min-w-0 gap-3`}>
        {p.marks.map((mark, i) => (
          <li key={mark.title} className="flex min-w-0 items-start gap-3">
            <span className="badge badge-outline badge-sm shrink-0">{i + 1}</span>
            <span className="flex min-w-0 flex-col">
              <strong>{mark.title}</strong>
              <span className={SMALL}>{mark.line}</span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={SMALL}>{p.caption}</figcaption>
    </figure>
  );
}

/** The address a section's heading is reached at from "On this page". */
export function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "2 · The promise": which of the four reads a section makes. */
function partEyebrow(part: TeardownSection["part"] & string): string {
  return copy("teardowns.part", {
    n: String(TEARDOWN_PARTS.indexOf(part) + 1),
    name: copy(`teardowns.part.${part}` as CopyKey),
  });
}

function PartFigure(p: { section: TeardownSection }): React.JSX.Element | null {
  const s = p.section;
  if (s.chips !== undefined) {
    return (
      <ul className="flex min-w-0 flex-wrap gap-2">
        {s.chips.map((chip) => (
          <li key={chip} className="badge badge-outline h-auto max-w-full break-words">
            {chip}
          </li>
        ))}
      </ul>
    );
  }
  if (s.promise !== undefined) {
    return (
      <figure className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-4">
            <p className={EYEBROW}>{copy("teardowns.promise.crowd")}</p>
            {TOOLS.map((letter) => (
              <span key={letter} className="flex min-w-0 flex-wrap items-baseline gap-2">
                <span className="text-base-content/70 font-mono text-xs">{copy("teardowns.promise.tool", { letter })}</span>
                <span className="break-words">{s.promise!.crowd}</span>
              </span>
            ))}
          </div>
          <div className="rounded-box border-base-300 flex min-w-0 flex-col gap-2 border p-4">
            <p className={EYEBROW}>{s.promise.wants}</p>
            {s.promise.outcomes.map((outcome) => (
              <span key={outcome} className="font-semibold break-words">
                {outcome}
              </span>
            ))}
          </div>
        </div>
        <figcaption className={SMALL}>{copy("teardowns.promise.caption")}</figcaption>
      </figure>
    );
  }
  if (s.buyers !== undefined) {
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {s.buyers.map((buyer) => (
          <div key={buyer.name} className="rounded-box border-base-300 flex min-w-0 flex-col items-start gap-2 border p-4">
            <strong>{buyer.name}</strong>
            <span className={SMALL}>{buyer.line}</span>
            <span className="badge badge-ghost h-auto max-w-full break-words">{buyer.wants}</span>
          </div>
        ))}
      </div>
    );
  }
  if (s.ideas !== undefined) {
    return (
      <figure className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {s.ideas.pages.map((idea) => (
            <div key={idea.title} className="rounded-box border-base-300 flex min-w-0 flex-col gap-2 border border-dashed p-4">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="badge badge-ghost">{idea.kind}</span>
                <span className={SMALL}>{idea.reader}</span>
              </span>
              <strong className="break-words">{idea.title}</strong>
            </div>
          ))}
        </div>
        <figcaption className={SMALL}>{s.ideas.caption}</figcaption>
      </figure>
    );
  }
  return null;
}

/** One section of a teardown: which read it makes, its heading, what it draws, and its words. */
export function PartSection(p: { section: TeardownSection }): React.JSX.Element {
  const s = p.section;
  return (
    <section className={CARD} aria-labelledby={anchorOf(s.heading)}>
      <div className={BODY}>
        {s.part === undefined ? null : <p className={EYEBROW}>{partEyebrow(s.part)}</p>}
        <h2 id={anchorOf(s.heading)} className="scroll-mt-24">
          {s.heading}
        </h2>
        <PartFigure section={s} />
        {s.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </section>
  );
}

/** Every heading of the article, linked. */
export function OnThisPage(p: { headings: readonly { id: string; label: string }[] }): React.JSX.Element {
  return (
    <nav aria-labelledby="on-this-page" className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
      <p id="on-this-page" className={EYEBROW}>
        {copy("teardowns.toc")}
      </p>
      <ul className="menu menu-sm w-full p-0">
        {p.headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`}>{h.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
