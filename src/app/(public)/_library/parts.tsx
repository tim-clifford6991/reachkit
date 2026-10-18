// Issue 1458 — the frame every library page shares: the about page's
// reading column, the one call to scan, and the sources line. daisyUI
// classes in place, no wrapper of a daisyUI part.
import type React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { longDate, type Source } from ".";

/** Attribute values, never sentences (the copy sweep). */
export const CARD = "card bg-base-100 shadow-(--shadow-card)";
export const BODY = "card-body gap-3";
export const LIST = "list-disc ps-6";
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
/** The landing's field, which is where every scan starts. */
const SCAN_HREF = `/#${FIELD_SECTION_ID}`;

/** The page: an eyebrow, the heading, and the column under it. */
export function LibraryPage(p: {
  testId: string;
  eyebrow: CopyKey;
  title: string;
  /** Wide pages (an index) use the about page's outer measure. */
  wide?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={p.testId}>
        <article
          className={`text-base-content/80 mx-auto flex w-full min-w-0 flex-col gap-3 leading-relaxed ${p.wide === true ? "" : "max-w-(--w-read)"}`}
        >
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
            {copy(p.eyebrow)}
          </span>
          <h1 className="break-words">{p.title}</h1>
          <div className="mt-3 flex min-w-0 flex-col gap-4">{p.children}</div>
        </article>
      </main>
    </Surface>
  );
}

/** One titled card of paragraphs. */
export function TextCard(p: { heading: string; paragraphs: readonly string[] }): React.JSX.Element {
  return (
    <section className={CARD}>
      <div className={BODY}>
        <h2>{p.heading}</h2>
        {p.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </section>
  );
}

/** The page's one call to action: the free scan, on the landing's field. */
export function ScanCta(): React.JSX.Element {
  return (
    <section className={`${CARD} bg-base-200`} data-testid="library-scan">
      <div className={`${BODY} items-start`}>
        <h2>{copy("landing.close.heading")}</h2>
        <p className="text-base-content/70 text-sm">{copy("landing.hero.assurance")}</p>
        <Link href={SCAN_HREF} className="btn btn-primary active:scale-[.98]">
          {copy("landing.start.cta")}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** Where the facts about another company were read, and when. */
export function Sources(p: { checked: string; sources: readonly Source[] }): React.JSX.Element {
  return (
    <section className="text-base-content/70 flex min-w-0 flex-col gap-2 text-sm" data-testid="library-sources">
      <p>{copy("library.checked", { date: longDate(p.checked) })}</p>
      {p.sources.length === 0 ? null : (
        <>
          <h2 className="text-base">{copy("library.sources")}</h2>
          <ul className={LIST}>
            {p.sources.map((source) => (
              <li key={source.href} className="break-words">
                {source.href.startsWith("/") ? (
                  <Link href={source.href} className="link">
                    {source.label}
                  </Link>
                ) : (
                  <a href={source.href} className="link" {...NEW_TAB}>
                    {source.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Back to the index the page belongs to. */
export function BackLink(p: { href: string; label: CopyKey }): React.JSX.Element {
  return (
    <p>
      <Link href={p.href} className="link link-primary">
        {copy(p.label)}
      </Link>
    </p>
  );
}
