// One teardown, at the address v1 published. Dated: when it was written and
// when it was last read against the live site; its reads are numbered parts.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteMark } from "@/ui/SiteMark";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { TEARDOWNS, longDate, teardownOf } from "../../_library";
import { BackLink, CARD, LearnClose, LibraryPage, Trademarks } from "../../_library/parts";
import { Sources } from "../../_library/sources";
import { anchorOf, OnThisPage, PartSection, Sketch } from "../../_library/teardown-parts";

/** Every teardown is known at build; any other address is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { site: string }[] {
  return TEARDOWNS.map((t) => ({ site: t.slug }));
}

type Params = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site } = await params;
  const t = teardownOf(site);
  if (t === undefined) return {};
  return publicMetadata({
    seo: PUBLIC_ROUTE_SEO.teardown,
    path: `/teardowns/${t.slug}`,
    vars: { title: t.title, description: t.description },
  });
}

const MORE: CopyKey = "teardowns.item.more";
const PAGE_TEST_ID = "teardown";
const INDEX = "/teardowns";
const TAKEAWAYS_ID = "takeaways";
const SOURCES_ID = "sources";

export default async function TeardownPage({ params }: Params): Promise<React.JSX.Element> {
  const { site } = await params;
  const t = teardownOf(site);
  if (t === undefined) notFound();

  return (
    <LibraryPage
      testId={PAGE_TEST_ID}
      title={t.title}
      wide
      trail={
        <>
          <nav aria-label={copy("compare.item.trail")} className="breadcrumbs text-base-content/70 py-0 text-sm">
            <ul>
              <li>
                <Link href={INDEX} className="link link-primary inline-flex min-h-11 items-center font-semibold">
                  {copy("chrome.nav.teardowns")}
                </Link>
              </li>
              <li className="num">{t.domain}</li>
            </ul>
          </nav>
          <SiteMark domain={t.domain} hasLogo={false} size={56} />
        </>
      }
    >
      {/* Issue 1512: the two dates the page prints, and the links it draws. */}
      <JsonLd
        blocks={articleSchemas({
          path: `${INDEX}/${t.slug}`,
          headline: t.title,
          published: t.written,
          modified: t.checked ?? t.revised,
          trail: [homeCrumb(), { name: copy("chrome.nav.teardowns"), path: INDEX }],
        })}
      />
      <section className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-base-content/70 text-sm">
            {t.checked === undefined
              ? copy("teardowns.item.dates", { written: longDate(t.written), revised: longDate(t.revised) })
              : copy("teardowns.item.dates.checked", { written: longDate(t.written), checked: longDate(t.checked) })}
          </p>
          <p className="text-lg">{t.intro}</p>
        </div>
        {t.sketch === undefined ? null : (
          <Sketch
            domain={t.domain}
            marks={t.sketch}
            caption={copy("teardowns.sketch.caption", { read: longDate(t.revised), checked: longDate(t.checked ?? t.revised) })}
          />
        )}
      </section>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]" data-testid="teardown-body">
        <article className="flex min-w-0 flex-col gap-4">
          {t.sections.map((section) => (
            <PartSection key={section.heading} section={section} />
          ))}
          <section className="rounded-box border-primary/20 bg-primary/10 flex min-w-0 flex-col gap-3 border p-5" aria-labelledby={TAKEAWAYS_ID}>
            <h2 id={TAKEAWAYS_ID} className="text-base-content scroll-mt-24">
              {copy("teardowns.item.takeaways")}
            </h2>
            <ol className="grid min-w-0 gap-3 sm:grid-cols-2">
              {t.takeaways.map((line, i) => (
                <li key={line} className={`${CARD} flex min-w-0 flex-col items-start gap-2.5 p-4`}>
                  <span className="rounded-field bg-primary text-primary-content grid size-8 place-items-center font-extrabold" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="text-base-content font-semibold">{line}</span>
                </li>
              ))}
            </ol>
          </section>
          <div id={SOURCES_ID} className="scroll-mt-24">
            <Sources checked={t.checked ?? t.revised} sources={t.sources} />
          </div>
        </article>
        <OnThisPage
          headings={[
            ...t.sections.map((s) => ({ id: anchorOf(s.heading), label: s.heading })),
            { id: TAKEAWAYS_ID, label: copy("teardowns.item.takeaways") },
            { id: SOURCES_ID, label: copy("library.sources") },
          ]}
        />
      </div>
      <LearnClose variant="teardown" />
      <Trademarks />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
