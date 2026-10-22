// Issue 1458 — the free tools, at the address v1 and v2 published: the two
// page tools and the free scan, which is what v2's AI visibility check became.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { LearnClose, LibraryPage } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.tools);

const EYEBROW: CopyKey = "tools.eyebrow";
const PAGE_TEST_ID = "tools";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";

const TOOLS: readonly { href: string; name: CopyKey; line: CopyKey }[] = [
  { href: "/tools/on-page-check", name: "tools.onpage.name", line: "tools.onpage.line" },
  { href: "/tools/meta-preview", name: "tools.meta.name", line: "tools.meta.line" },
  { href: `/#${FIELD_SECTION_ID}`, name: "tools.scan.name", line: "tools.scan.line" },
];

export default function ToolsPage(): React.JSX.Element {
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.title")} wide>
      <p className="max-w-(--w-read)">{copy("tools.lead")}</p>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.href} className="flex min-w-0">
            <Link href={tool.href} className={`${TILE} w-full min-w-0`}>
              <span className="card-body gap-2">
                <span className="card-title flex items-center justify-between gap-2 text-base">
                  <span className="min-w-0 break-words">{copy(tool.name)}</span>
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                </span>
                <span className="text-base-content/70 text-sm">{copy(tool.line)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <LearnClose variant="tools" />
    </LibraryPage>
  );
}
