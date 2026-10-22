// Issue 1458 — one teardown, at the address v1 published. Dated: when it
// was written and when it was last read against the live site.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { TEARDOWNS, longDate, teardownOf } from "../../_library";
import { BackLink, BODY, CARD, LearnClose, LibraryPage, Sketch, Sources, TextCard, Trademarks } from "../../_library/parts";

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

const EYEBROW: CopyKey = "teardowns.eyebrow";
const MORE: CopyKey = "teardowns.item.more";
const PAGE_TEST_ID = "teardown";
const INDEX = "/teardowns";

export default async function TeardownPage({ params }: Params): Promise<React.JSX.Element> {
  const { site } = await params;
  const t = teardownOf(site);
  if (t === undefined) notFound();

  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={t.title}>
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
      <p className="text-base-content/70 font-mono text-xs">
        {t.checked === undefined
          ? copy("teardowns.item.dates", { written: longDate(t.written), revised: longDate(t.revised) })
          : copy("teardowns.item.dates.checked", { written: longDate(t.written), checked: longDate(t.checked) })}
      </p>
      <p className="text-lg">{t.intro}</p>
      {t.sketch === undefined ? null : (
        <Sketch
          domain={t.domain}
          marks={t.sketch}
          caption={copy("teardowns.sketch.caption", { read: longDate(t.revised), checked: longDate(t.checked ?? t.revised) })}
        />
      )}
      {t.sections.map((section) => (
        <TextCard key={section.heading} heading={section.heading} paragraphs={section.paragraphs} />
      ))}
      <section className={CARD}>
        <div className={BODY}>
          <h2>{copy("teardowns.item.takeaways")}</h2>
          <ol className="list-decimal ps-6">
            {t.takeaways.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </section>
      <LearnClose variant="teardown" />
      <Sources checked={t.checked ?? t.revised} sources={t.sources} />
      <Trademarks />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
