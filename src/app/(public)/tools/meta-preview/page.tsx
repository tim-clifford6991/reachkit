// Issue 1458 — the free meta tag preview, at the address v1 and v2
// published. How the page reads in a Google result, how its link looks when
// shared, and every tag behind the two. Nothing is stored or paid for.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { BackLink, BODY, CARD, checkedDomain, LearnClose, LibraryPage } from "../../_library/parts";
import { PREVIEW_TAGS, tagValue } from "../_check/checks";
import { readPage, type PageTags } from "../_check/read";
import { ReadProblem, ToolForm } from "../_check/ToolForm";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.metaPreview);

const EYEBROW: CopyKey = "tools.eyebrow";
const MORE: CopyKey = "tools.more";
const PAGE_TEST_ID = "meta-preview";
const INDEX = "/tools";
const NO_REFERRER = "no-referrer";
/** The image repeats the card's own title, so it is decorative. */
const DECORATIVE = "";

type Props = { searchParams: Promise<{ url?: string | string[] }> };

/** An `og:image` drawn only where it is an absolute https address. */
function shareImage(t: PageTags): string | null {
  const raw = t.share["og:image"] ?? t.share["twitter:image"] ?? "";
  try {
    const url = new URL(raw, t.url);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Preview(p: { tags: PageTags }): React.JSX.Element {
  const t = p.tags;
  const host = new URL(t.url).hostname;
  const title = t.share["og:title"] || t.title;
  const description = t.share["og:description"] || t.description;
  const image = shareImage(t);
  return (
    <>
      <section className={CARD} data-testid="meta-preview-google">
        <div className={BODY}>
          <h2>{copy("tools.preview.google")}</h2>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base-content/70 truncate font-mono text-xs">{t.url}</span>
            <span className="text-primary line-clamp-2 text-lg break-words">
              {t.title === "" ? copy("tools.preview.untitled") : t.title}
            </span>
            <span className="text-base-content/70 line-clamp-2 text-sm break-words">
              {t.description === "" ? copy("tools.preview.undescribed") : t.description}
            </span>
          </div>
        </div>
      </section>

      <section className={CARD} data-testid="meta-preview-share">
        <div className={BODY}>
          <h2>{copy("tools.preview.share")}</h2>
          <div className="border-base-300 flex min-w-0 flex-col overflow-hidden rounded-box border">
            {image === null ? (
              <div className="bg-base-200 text-base-content/70 flex aspect-[1.91/1] items-center justify-center text-sm">
                {copy("tools.preview.noimage")}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- another site's image, drawn as it is shared
              <img src={image} alt={DECORATIVE} referrerPolicy={NO_REFERRER} className="aspect-[1.91/1] w-full object-cover" />
            )}
            <div className="flex min-w-0 flex-col gap-1 p-3">
              <span className="text-base-content/70 truncate font-mono text-xs">{host}</span>
              <span className="line-clamp-2 font-semibold break-words">
                {title === "" ? copy("tools.preview.untitled") : title}
              </span>
              <span className="text-base-content/70 line-clamp-2 text-sm break-words">
                {description === "" ? copy("tools.preview.undescribed") : description}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={CARD} data-testid="meta-preview-tags">
        <div className={BODY}>
          <h2>{copy("tools.preview.tags")}</h2>
          <ul className="list min-w-0">
            {PREVIEW_TAGS.map((tag) => {
              const value = tagValue(t, tag);
              return (
                <li key={tag} className="list-row min-w-0 items-start">
                  <span className={`badge badge-sm ${value === "" ? "badge-warning" : "badge-success"}`}>
                    {copy(value === "" ? "tools.status.fix" : "tools.status.fine")}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-sm">{tag}</span>
                    {value === "" ? null : (
                      <span className="text-base-content/70 line-clamp-2 text-sm break-words">{value}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}

async function Result(p: { raw: string }): Promise<React.JSX.Element> {
  const read = await readPage(p.raw, (await headers()).get("x-forwarded-for"));
  if (!read.ok) return <ReadProblem read={read} />;
  return <Preview tags={read.tags} />;
}

export default async function MetaPreviewPage({ searchParams }: Props): Promise<React.JSX.Element> {
  const raw = (await searchParams).url;
  const value = typeof raw === "string" ? raw : "";
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.meta.name")}>
      <p>{copy("tools.meta.intro")}</p>
      <ToolForm value={value} />
      {value === "" ? null : <Result raw={value} />}
      <LearnClose variant="tool-meta" domain={checkedDomain(value)} />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
