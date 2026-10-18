// SPEC §7 (2026-10-18, issue 1511) — whether the customer's main site links
// their articles, as Overview states it: once, in plain words, with the link
// ready to copy.
//
// **A finding, never a step.** Nothing waits on it and nothing is held by
// it. It is said only while the weekly scan found no followed link from the
// main site's own pages to the content host, and never again once it finds
// one. A WordPress destination has nothing to say: its pages are on the main
// site already. A host that is not live yet has nothing either: the link
// would lead nowhere, and Overview is already saying how to connect it.
//
// The snippet's words are the blog's own name in the site's language (D66):
// the link stands on the customer's site, not on a ReachKit screen.
import { copyIn } from "@/lib/presentation/copy/translated";
import { siteLocale } from "@/lib/locale/site";
import { readMainSite } from "@/lib/site-profile/store";
import type { MainSiteLinkFinding } from "@/lib/site-profile/main-site-row";
import { hostedHostFor } from "./hostname";

export type { MainSiteLinkFinding };

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The `<a href>` the main site adds, in the site's language. */
export function linkSnippet(host: string, language: Parameters<typeof copyIn>[0]): string {
  return `<a href="https://${escape(host)}/">${escape(copyIn(language, "hosted.index.heading"))}</a>`;
}

/** What Overview says about the main-site link, or `null` where it says
 *  nothing. Never throws. */
export async function mainSiteLinkFinding(a: { siteId: string; domain: string }): Promise<MainSiteLinkFinding | null> {
  try {
    const host = await hostedHostFor(a.siteId);
    if (host === null || host.state !== "live") return null;
    const hostname = host.hostname.trim().toLowerCase();
    const mainSite = await readMainSite(a.domain);
    const link = mainSite?.links.find((entry) => entry.host === hostname.replace(/^www\./, ""));
    if (link === undefined || link.state === "linked") return null;
    const { language } = await siteLocale(a.siteId);
    return { state: link.state, host: hostname, snippet: linkSnippet(hostname, language) };
  } catch {
    return null;
  }
}
