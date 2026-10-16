// Issue 1458 — the free on-page check, at the address v1 and v2 published.
// One page, read once, ten checks, each fine or to fix with what was found.
// It costs nothing: no vendor, no model, nothing stored.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CircleCheck, CircleAlert } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { BackLink, BODY, CARD, LibraryPage, ScanCta } from "../../_library/parts";
import { onPageChecks } from "../_check/checks";
import { readPage } from "../_check/read";
import { ReadProblem, ToolForm } from "../_check/ToolForm";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.onPageCheck);

const EYEBROW: CopyKey = "tools.eyebrow";
const MORE: CopyKey = "tools.more";
const PAGE_TEST_ID = "on-page-check";
const INDEX = "/tools";

type Props = { searchParams: Promise<{ url?: string | string[] }> };

async function Result(p: { raw: string }): Promise<React.JSX.Element> {
  const read = await readPage(p.raw, (await headers()).get("x-forwarded-for"));
  if (!read.ok) return <ReadProblem read={read} />;
  const checks = onPageChecks(read.tags);
  const fine = checks.filter((c) => c.fine).length;
  return (
    <section className={CARD} data-testid="on-page-result">
      <div className={BODY}>
        <h2 className="break-words">
          {copy("tools.result", { fine, total: checks.length, url: read.tags.url })}
        </h2>
        <ul className="list min-w-0">
          {checks.map((c) => (
            <li key={c.name} className="list-row min-w-0 items-start">
              {c.fine ? (
                <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="text-success" />
              ) : (
                <CircleAlert size={20} strokeWidth={1.75} aria-hidden className="text-warning" />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {copy(c.name)}
                  <span className={`badge badge-sm ${c.fine ? "badge-success" : "badge-warning"}`}>
                    {copy(c.fine ? "tools.status.fine" : "tools.status.fix")}
                  </span>
                </span>
                <span className="text-base-content/70 line-clamp-2 text-sm break-words">{c.line}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default async function OnPageCheckPage({ searchParams }: Props): Promise<React.JSX.Element> {
  const raw = (await searchParams).url;
  const value = typeof raw === "string" ? raw : "";
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.onpage.name")}>
      <p>{copy("tools.onpage.line")}</p>
      <ToolForm value={value} />
      {value === "" ? null : <Result raw={value} />}
      <ScanCta />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
