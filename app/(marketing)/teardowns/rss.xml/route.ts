import { allTeardowns } from "@/content/teardowns";
import { SITE } from "@/lib/seo";

/** RSS 2.0 feed of ReachKit teardowns — served at /teardowns/rss.xml. */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GET() {
  const items = allTeardowns
    .map((t) => {
      const url = `${SITE.url}/teardowns/${t.slug}`;
      const pubDate = new Date(`${t.publishedAt}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${esc(t.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(t.intro)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ReachKit Teardowns</title>
    <link>${SITE.url}/teardowns</link>
    <atom:link href="${SITE.url}/teardowns/rss.xml" rel="self" type="application/rss+xml" />
    <description>Discoverability teardowns of real apps — what the scan finds and how to fix it.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
