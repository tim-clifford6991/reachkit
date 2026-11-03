// A teardown's own parts: the sketch of the page it read, the four numbered
// reads with what each draws, and the list of what is on the page. daisyUI
// classes in place, greyscale, no logo and no brand colour.
import type React from "react";
import { Check, CircleCheck, Clock4, FileText, User } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { TEARDOWN_PARTS, type SketchMark, type TeardownSection } from "./types";
import { CARD } from "./parts";

const SMALL = "text-base-content/70 text-sm";
const EYEBROW = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const FRAME = "mockup-browser border-base-300 bg-base-200 min-w-0 border";
const TOOLS = ["A", "B", "C"] as const;
const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;
const SKELETON = "bg-base-300 block h-2 rounded-full";
/** The address pill: the domain alone; daisyUI's toolbar input would paint a magnifier. */
const PILL = "bg-base-100 border-base-300 flex h-7 w-full min-w-0 items-center rounded-full border px-3";
/** A solid round marker; greyscale, as the sketch of another company's page stays (E15). The second place is the lighter one, as the board draws it. */
const MARK = "grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold text-base-100";
const markTone = (i: number): string => (i === 1 ? "bg-base-content/70" : "bg-base-content");
/** A label the page shows in its own quote marks: the promise the sketch points at. */
const isQuoted = (label: string): boolean => /^['‘]/.test(label);

/** A greyscale wireframe of another company's page, numbered where the
 *  article points, with the page's own words; what each number marks is
 *  listed under it. */
export function Sketch(p: { domain: string; marks: readonly SketchMark[]; caption: string }): React.JSX.Element {
  return (
    <figure className="flex min-w-0 flex-col gap-3" data-testid="teardown-sketch">
      <div className={FRAME}>
        <div className="mockup-browser-toolbar">
          <div className={PILL}>
            <span className="min-w-0 truncate font-mono text-xs">{p.domain}</span>
          </div>
        </div>
        <ol className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
          {p.marks.map((mark, i) => (
            <li key={mark.title} className="flex min-w-0 flex-col gap-3">
              {mark.lower === true ? <p className={`${SMALL} text-center`}>{copy("teardowns.sketch.lower")}</p> : null}
              <div className="flex min-w-0 items-start gap-3">
                <span className={`${MARK} ${markTone(i)}`} aria-hidden>
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  {mark.quotes.map((quote, q) => (
                    <p key={quote} className={i === 0 && q === 0 ? "text-base-content text-lg font-extrabold break-words" : "text-sm break-words"}>
                      <q>{quote}</q>
                    </p>
                  ))}
                  {i === 0 ? (
                    <span aria-hidden="true" className="flex gap-2">
                      <span aria-hidden="true" className="bg-base-300 rounded-field h-6 w-24" />
                      <span aria-hidden="true" className="border-base-300 rounded-field h-6 w-18 border" />
                    </span>
                  ) : null}
                  {mark.shows === undefined ? null : (
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {mark.shows.map((label) => (
                        <span
                          key={label}
                          className={`badge h-auto max-w-full break-words ${isQuoted(label) ? "badge-outline text-base-content border-dashed font-bold" : "badge-ghost"}`}
                        >
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
            <span className={`${MARK} ${markTone(i)}`} aria-hidden>
              {i + 1}
            </span>
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
          <li key={chip} className="badge badge-outline h-auto max-w-full gap-1.5 py-1 break-words">
            <Check {...ICON} className="text-success shrink-0" />
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
          <div className="flex min-w-0 flex-col gap-2">
            <p className={EYEBROW}>{copy("teardowns.promise.crowd")}</p>
            <div className="grid min-w-0 grid-cols-3 gap-2">
              {TOOLS.map((letter) => (
                <span key={letter} className="rounded-field bg-base-200 flex min-w-0 flex-col gap-1.5 p-2.5">
                  <span className="text-base-content/70 font-mono text-xs">{copy("teardowns.promise.tool", { letter })}</span>
                  <span className="text-sm break-words">{s.promise!.crowd}</span>
                  <span aria-hidden="true" className={`${SKELETON} w-full`} />
                  <span aria-hidden="true" className={`${SKELETON} w-2/3`} />
                </span>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-success text-xs font-semibold tracking-wide uppercase">{s.promise.wants}</p>
            <div className="rounded-box border-success bg-success/10 flex min-w-0 flex-col gap-2 border p-4">
              {s.promise.outcomes.map((outcome) => (
                <span key={outcome} className="text-base-content flex min-w-0 items-start gap-2 font-semibold break-words">
                  <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="text-success mt-1 shrink-0" />
                  {outcome}
                </span>
              ))}
            </div>
          </div>
        </div>
        <figcaption className={SMALL}>{copy("teardowns.promise.caption")}</figcaption>
      </figure>
    );
  }
  if (s.buyers !== undefined) {
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {s.buyers.map((buyer) => {
          const Icon = buyer.icon ?? User;
          return (
            <div
              key={buyer.name}
              className={`rounded-box flex min-w-0 flex-col items-start gap-2 border p-4 ${buyer.deadline === true ? "border-primary border-2" : "border-base-300"}`}
            >
              <span className={`rounded-field grid size-10 place-items-center ${buyer.deadline === true ? "bg-primary/10 text-primary" : "bg-base-200"}`}>
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <strong className="text-base-content">{buyer.name}</strong>
              <span className={SMALL}>{buyer.line}</span>
              <span className={`badge h-auto max-w-full gap-1.5 break-words ${buyer.deadline === true ? "badge-primary" : "badge-ghost"}`}>
                {buyer.deadline === true ? <Clock4 {...ICON} /> : null}
                {buyer.wants}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  if (s.ideas !== undefined) {
    return (
      <figure className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {s.ideas.pages.map((idea) => (
            <div key={idea.title} className="rounded-box border-success flex min-w-0 flex-col gap-2 border-2 border-dashed p-4">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="badge badge-success badge-soft gap-1">
                  <FileText {...ICON} />
                  {idea.kind}
                </span>
                <span className={SMALL}>{idea.reader}</span>
              </span>
              <strong className="break-words">{idea.title}</strong>
              <span aria-hidden="true" className={`${SKELETON} w-full`} />
              <span aria-hidden="true" className={`${SKELETON} w-2/3`} />
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
    <section className="border-base-300 flex min-w-0 flex-col gap-3 border-t pt-6" aria-labelledby={anchorOf(s.heading)}>
      {s.part === undefined ? null : <p className={EYEBROW}>{partEyebrow(s.part)}</p>}
      <h2 id={anchorOf(s.heading)} className="text-base-content scroll-mt-24">
        {s.heading}
      </h2>
      <PartFigure section={s} />
      {s.paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </section>
  );
}

/** Every heading of the article, linked. */
export function OnThisPage(p: { headings: readonly { id: string; label: string }[] }): React.JSX.Element {
  return (
    <nav aria-labelledby="on-this-page" className="rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-4 lg:sticky lg:top-24 lg:self-start">
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
