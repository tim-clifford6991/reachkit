// SPEC §1 (2026-10-10, issue 1396) — who builds ReachKit, and why.
// src/app/(public)/about/page.tsx
//
// Three cards: who builds it, why it exists, and the rules it keeps, then a
// link to `/how-it-works`. The founder's name and place are the ones
// ReachKit's own articles print, read from the same stored byline
// (`_how/examples.ts`); where none is stored the sentence is not drawn, and
// the imprint still names the operator.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { readLiveExamples } from "../_how/examples";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.about);

// The founder's line is a stored row, read per request.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences (the copy sweep). */
const CARD = "card bg-base-100 shadow-(--shadow-card)";
const BODY = "card-body gap-3";
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const PAGE_TEST_ID = "about";

export default async function AboutPage(): Promise<React.JSX.Element> {
  const { founder, page } = await readLiveExamples();

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={PAGE_TEST_ID}>
        <article className="text-base-content/80 mx-auto flex w-full min-w-0 max-w-(--w-read) flex-col gap-3 leading-relaxed">
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
            {copy("about.eyebrow")}
          </span>
          <h1>{copy("about.title")}</h1>

          <div className="mt-3 flex flex-col gap-4">
            <section className={CARD}>
              <div className={BODY}>
                <h2>{copy("about.who.title")}</h2>
                {founder === null ? null : (
                  <p>
                    {founder.place === null
                      ? copy("about.who.founder", { name: founder.name })
                      : copy("about.who.founder.place", { name: founder.name, place: founder.place })}
                  </p>
                )}
                <p>
                  <Link href="/imprint" className="link link-primary">
                    {copy("about.who.imprint")}
                  </Link>
                </p>
                {page === null ? null : (
                  <p className="flex flex-wrap gap-x-2">
                    <span>{copy("about.who.own")}</span>
                    <a href={page.url} className="link link-primary" {...NEW_TAB}>
                      {page.title}
                    </a>
                  </p>
                )}
              </div>
            </section>

            <section className={CARD}>
              <div className={BODY}>
                <h2>{copy("about.why.title")}</h2>
                <p>{copy("about.why.problem")}</p>
                <p>{copy("about.why.answer")}</p>
              </div>
            </section>

            <section className={CARD}>
              <div className={BODY}>
                <h2>{copy("about.rules.title")}</h2>
                <p>{copy("about.rules.lead")}</p>
                <ul className="list-disc ps-6">
                  <li>{copy("how.never.invent")}</li>
                  <li>{copy("how.never.hide")}</li>
                  <li>{copy("how.never.promise")}</li>
                </ul>
                <p>{copy("about.rules.source")}</p>
                <p>{copy("about.rules.unmeasured")}</p>
              </div>
            </section>
          </div>

          <p className="mt-3">
            <Link href="/how-it-works" className="btn btn-primary">
              {copy("about.how")}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
            </Link>
          </p>
        </article>
      </main>
    </Surface>
  );
}
