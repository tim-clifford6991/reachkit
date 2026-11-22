// SPEC §7 (2026-10-10) the site link map, off the live articles: which of the customer's pages they link, and which
// stand alone, each a count with its list behind *Show*. ReachKit chooses and repairs links, so it offers no control.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { LinkMap } from "@/lib/known-content/link-map";
import { CARD, CARD_BODY, CARD_LEAD, CARD_TITLE } from "../frame";
import { ShowList } from "./KnownContentPanel";
import { SettingLine } from "./SettingRow";

function aloneLine(article: { linkedFrom: number; linksOut: number }): string {
  if (article.linkedFrom === 0 && article.linksOut === 0) return copy("settings.linkmap.alone.both");
  return copy(article.linkedFrom === 0 ? "settings.linkmap.alone.in" : "settings.linkmap.alone.out");
}

const pages = (n: number): string => (n === 1 ? copy("settings.pages.one") : copy("settings.pages.count", { count: String(n) }));

function Count(p: { label: string; testId: string; rows: readonly { key: string; text: React.ReactNode; line: string }[] }): React.JSX.Element {
  const none = p.rows.length === 0;
  return (
    <SettingLine
      label={p.label}
      value={none ? { kind: "empty", text: copy("settings.none") } : { kind: "text", text: pages(p.rows.length), full: pages(p.rows.length) }}
      testId={p.testId}
      action={none ? null : <ShowList label={p.label} testId={`${p.testId}-dialog`} rows={p.rows} />}
    />
  );
}

export function LinkMapPanel(p: { map: LinkMap }): React.JSX.Element {
  const link = (url: string, text: string): React.ReactNode => (
    <a className="link link-hover" href={url} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
  return (
    <section className={CARD} data-testid="settings-link-map">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-col">
          <h2 className={CARD_TITLE}>{copy("settings.linkmap.head")}</h2>
          <p className={CARD_LEAD}>{copy("settings.linkmap.note")}</p>
        </div>
        <div className="flex min-w-0 flex-col">
          <Count
            label={copy("settings.linkmap.receiving")}
            testId="settings-link-map-receiving"
            rows={p.map.receiving.map((page) => ({
              key: page.url,
              text: link(page.url, page.url),
              line: page.articles === 1 ? copy("settings.linkmap.receiving.one") : copy("settings.linkmap.receiving.count", { count: String(page.articles) }),
            }))}
          />
          <Count
            label={copy("settings.linkmap.alone")}
            testId="settings-link-map-alone"
            rows={p.map.alone.map((article) => ({ key: article.url, text: link(article.url, article.url), line: aloneLine(article) }))}
          />
        </div>
      </div>
    </section>
  );
}
