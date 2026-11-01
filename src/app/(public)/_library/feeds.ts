// Issue 1458 — the two plain documents the library serves: the teardowns'
// RSS feed and llms.txt, the summary of ReachKit for AI readers. Each is
// composed from the articles and from copy keys, never typed twice.
import { copy } from "@/lib/presentation/copy";
import { ANSWERS, COMPARISONS, TEARDOWNS } from ".";
import { HOW_FACTS } from "../_how/facts";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The feed, with every link absolute against `origin`. */
export function teardownsFeed(origin: string): string {
  const at = (path: string): string => xmlEscape(new URL(path, origin).toString());
  const items = [...TEARDOWNS]
    .sort((a, b) => b.revised.localeCompare(a.revised) || a.slug.localeCompare(b.slug))
    .map(
      (t) =>
        "    <item>\n" +
        `      <title>${xmlEscape(t.title)}</title>\n` +
        `      <link>${at(`/teardowns/${t.slug}`)}</link>\n` +
        `      <guid isPermaLink="true">${at(`/teardowns/${t.slug}`)}</guid>\n` +
        `      <pubDate>${new Date(`${t.written}T00:00:00Z`).toUTCString()}</pubDate>\n` +
        `      <description>${xmlEscape(t.summary)}</description>\n` +
        "    </item>\n"
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    "  <channel>\n" +
    `    <title>${xmlEscape(copy("meta.teardowns.title"))}</title>\n` +
    `    <link>${at("/teardowns")}</link>\n` +
    `    <description>${xmlEscape(copy("meta.teardowns.description"))}</description>\n` +
    "    <language>en</language>\n" +
    items +
    "  </channel>\n" +
    "</rss>\n"
  );
}

/**
 * llms.txt (llmstxt.org): what ReachKit is and does, in the product's own
 * public sentences, then every page worth reading, each with one line.
 */
export function llmsText(origin: string): string {
  const at = (path: string): string => new URL(path, origin).toString();
  const line = (name: string, path: string, about: string): string => `- [${name}](${at(path)}): ${about}`;
  return [
    `# ${copy("chrome.wordmark")}`,
    "",
    `> ${copy("landing.subline")}`,
    "",
    copy("about.why.problem"),
    "",
    copy("about.why.answer"),
    "",
    copy("pricing.subline", { weekPages: HOW_FACTS.weekPages }),
    "",
    `## ${copy("chrome.footer.product")}`,
    "",
    line(copy("chrome.cta.scan"), "/", copy("meta.landing.description", { weekPages: HOW_FACTS.weekPages })),
    line(copy("chrome.nav.works"), "/how-it-works", copy("meta.how.description")),
    line(copy("chrome.nav.pricing"), "/pricing", copy("meta.pricing.description", { weekPages: HOW_FACTS.weekPages })),
    line(copy("chrome.nav.scans"), "/scans", copy("meta.scans.description")),
    line(copy("chrome.nav.about"), "/about", copy("meta.about.description")),
    "",
    `## ${copy("chrome.nav.tools")}`,
    "",
    line(copy("tools.meta.name"), "/tools/meta-preview", copy("tools.meta.line")),
    line(copy("tools.onpage.name"), "/tools/on-page-check", copy("tools.onpage.line")),
    "",
    `## ${copy("chrome.nav.compare")}`,
    "",
    ...COMPARISONS.map((c) => line(c.title, `/compare/${c.slug}`, c.summary)),
    "",
    `## ${copy("chrome.nav.teardowns")}`,
    "",
    ...TEARDOWNS.map((t) => line(t.title, `/teardowns/${t.slug}`, t.summary)),
    "",
    `## ${copy("answers.faq")}`,
    "",
    ...ANSWERS.map((a) => line(a.title, `/answers/${a.slug}`, a.description)),
    "",
  ].join("\n");
}
