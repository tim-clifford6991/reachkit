// Issue 1458 — the free meta tag preview, at the address v1 and v2
// published. How the page reads in a Google result, how its link looks when
// shared, and every tag behind the two. Nothing is stored or paid for.
// Before an address is typed it draws the example page, in the same shape.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { BackLink, BODY, CARD, checkedDomain, LearnClose, LibraryPage } from "../../_library/parts";
import { DESCRIPTION_MAX, PREVIEW_TAGS, tagName, tagValue, tagWords, TITLE_MAX } from "../_check/checks";
import { EXAMPLE_META } from "../_check/example";
import { Callout, GoogleResult, MicroLine, pagePlace, ResultHead, RESULT_ID, Status } from "../_check/parts";
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
  const raw = t.share["og:image"] || t.share["twitter:image"] || "";
  if (raw === "") return null;
  try {
    const url = new URL(raw, t.url);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const SMALL = "text-base-content/70 text-sm";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const LIST = new Intl.ListFormat("en", { type: "conjunction" });

/** How long a title or text is, and whether a Google result shows all of it. */
function length(value: string, max: number): { line: string; fine: boolean } {
  if (value === "") return { line: copy("tools.preview.chars.none"), fine: false };
  const chars = [...value].length;
  return chars > max
    ? { line: copy("tools.preview.chars.long", { chars }), fine: false }
    : { line: copy("tools.preview.chars.fits", { chars }), fine: true };
}

function Note(p: { n: number; label: string; line: string; fine: boolean }): React.JSX.Element {
  return (
    <li className="list-row min-w-0 items-start">
      <Callout n={p.n} />
      <span className="min-w-0 text-sm break-words">
        <strong>{p.label}</strong> {p.line}
      </span>
      <Status fine={p.fine} />
    </li>
  );
}

function Preview(p: { tags: PageTags; example: boolean }): React.JSX.Element {
  const t = p.tags;
  const host = new URL(t.url).hostname;
  const title = t.share["og:title"] || t.title;
  const description = t.share["og:description"] || t.description;
  const image = shareImage(t);
  const tags = PREVIEW_TAGS.map((tag) => ({ tag, value: tagValue(t, tag), ...tagWords(tag) }));
  const missing = tags.filter((row) => row.value === "");
  const titleLength = length(t.title, TITLE_MAX);
  const textLength = length(t.description, DESCRIPTION_MAX);
  return (
    <section aria-labelledby={RESULT_ID} className="flex min-w-0 flex-col gap-4" data-testid="meta-preview-result">
      <ResultHead heading={copy("tools.preview.of", { page: pagePlace(t.url) })} example={p.example} />

      <div className={CARD} data-testid="meta-preview-score">
        <div className={`${BODY} sm:flex-row sm:items-center`}>
          <span className="flex items-baseline gap-1">
            <strong className="text-3xl">{tags.length - missing.length}</strong>
            <span className={SMALL}>{copy("tools.preview.fine", { total: tags.length })}</span>
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            <span className="flex gap-1" aria-hidden>
              {tags.map((row) => (
                <span key={row.tag} aria-hidden className={`size-4 rounded-sm ${row.value === "" ? "bg-warning" : "bg-success"}`} />
              ))}
            </span>
            <span className="flex flex-wrap gap-x-4 text-sm">
              <span>{copy("tools.preview.fine.count", { n: tags.length - missing.length })}</span>
              {missing.length === 0 ? null : (
                <span>{copy("tools.preview.fix.count", { n: missing.length, names: LIST.format(missing.map((row) => row.name)) })}</span>
              )}
            </span>
          </span>
        </div>
      </div>

      <div className={CARD} data-testid="meta-preview-google">
        <div className={BODY}>
          <h3 className={LABEL}>{copy("tools.preview.google")}</h3>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <GoogleResult tags={t} numbered />
            <ul className="list min-w-0">
              <Note n={1} label={copy("tools.preview.title")} {...titleLength} />
              <Note n={2} label={copy("tools.preview.text")} {...textLength} />
            </ul>
          </div>
        </div>
      </div>

      <div className={CARD} data-testid="meta-preview-share">
        <div className={BODY}>
          <h3 className={LABEL}>{copy("tools.preview.share")}</h3>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <div className="border-base-300 flex min-w-0 flex-col overflow-hidden rounded-box border">
              {image === null ? (
                <div className="bg-base-200 text-base-content/70 flex aspect-[1.91/1] items-center justify-center gap-2 text-sm">
                  <Callout n={3} />
                  <strong>{copy("tools.preview.noimage")}</strong>
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
            <ul className="list min-w-0">
              <li className="list-row min-w-0 items-start">
                <Callout n={3} />
                <span className="min-w-0 text-sm break-words">
                  {copy(image === null ? "tools.preview.image.none" : "tools.preview.image.fine")}
                </span>
                <Status fine={image !== null} />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className={CARD} data-testid="meta-preview-tags">
        <div className={BODY}>
          <h3 className={LABEL}>{copy("tools.preview.tags")}</h3>
          <ul className="list min-w-0">
            {tags.map((row) => (
              <li key={row.tag} className="list-row min-w-0 items-start">
                <span className="w-32 shrink-0 font-mono text-sm break-words">{tagName(row.tag)}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-sm break-words">
                    {row.value === "" ? copy("tools.preview.missing") : row.value}
                  </span>
                  <span className={SMALL}>{row.what}</span>
                </span>
                <Status fine={row.value !== ""} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

async function Result(p: { raw: string }): Promise<React.JSX.Element> {
  const read = await readPage(p.raw, (await headers()).get("x-forwarded-for"));
  if (!read.ok) return <ReadProblem read={read} />;
  return <Preview tags={read.tags} example={false} />;
}

export default async function MetaPreviewPage({ searchParams }: Props): Promise<React.JSX.Element> {
  const raw = (await searchParams).url;
  const value = typeof raw === "string" ? raw : "";
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.meta.name")}>
      <p>{copy("tools.meta.intro")}</p>
      <ToolForm value={value} />
      <MicroLine />
      {value === "" ? <Preview tags={EXAMPLE_META} example /> : <Result raw={value} />}
      <LearnClose variant="tool-meta" domain={checkedDomain(value)} />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
