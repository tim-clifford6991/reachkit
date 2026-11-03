// Where the facts about another company were read, and when: the dated line and each source's link.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { longDate, type Source } from ".";
import { LIST } from "./parts";

const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const SOURCE_LINK = "link link-primary link-hover inline-flex min-h-11 items-center";

/** Where the facts about another company were read, and when. */
export function Sources(p: {
  checked: string;
  sources: readonly Source[];
  id?: string;
  /** The date and "Sources" as one heading, each host in the code face (canvas v36 PubCompareTool, PubAnswer). */
  oneLine?: true;
}): React.JSX.Element {
  const checked = copy("library.checked", { date: longDate(p.checked) });
  return (
    <section
      aria-labelledby={p.id}
      className="text-base-content/70 flex min-w-0 scroll-mt-20 flex-col gap-2 text-sm"
      data-testid="library-sources"
    >
      {p.oneLine && p.sources.length > 0 ? null : <p>{checked}</p>}
      {p.sources.length === 0 ? null : (
        <>
          <h2 id={p.id} className="text-base">
            {p.oneLine ? `${checked} ${copy("library.sources")}` : copy("library.sources")}
          </h2>
          <ul className={LIST}>
            {p.sources.map((source) => (
              <li key={source.href} className="break-words">
                {source.href.startsWith("/") ? (
                  <Link href={source.href} className={SOURCE_LINK}>
                    {source.label}
                  </Link>
                ) : (
                  p.oneLine ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      <a href={source.href} className={SOURCE_LINK} {...NEW_TAB}>
                        {source.label}
                      </a>
                      <span className="font-mono text-xs">{new URL(source.href).hostname}</span>
                    </span>
                  ) : (
                    <a href={source.href} className={SOURCE_LINK} {...NEW_TAB}>
                      {copy("library.source", { label: source.label, host: new URL(source.href).hostname })}
                    </a>
                  )
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
