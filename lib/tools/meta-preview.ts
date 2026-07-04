/**
 * Meta & social preview (W3) — pure logic behind /tools/meta-preview.
 *
 * Extracts the exact tags Google / X / LinkedIn read from a page, resolves
 * the effective values each surface would render (with their real fallback
 * chains), and grades a missing/weak-tags checklist. No paid APIs.
 */

import { parse } from "node-html-parser";
import type { ToolCheck } from "@/lib/tools/ai-visibility";

export interface PreviewTags {
  title: string;
  metaDescription: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogSiteName: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

/** Resolve a possibly-relative asset URL against the page URL ("" on failure). */
function absolute(src: string, pageUrl: string): string {
  if (!src) return "";
  try {
    return new URL(src, pageUrl).toString();
  } catch {
    return "";
  }
}

/** Extract the raw preview tags from page HTML (image URLs made absolute). */
export function extractPreviewTags(html: string, pageUrl: string): PreviewTags {
  const root = parse(html);
  const meta = (attr: "name" | "property", key: string): string =>
    root.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content")?.trim() ?? "";

  return {
    title: root.querySelector("title")?.text?.trim() ?? "",
    metaDescription: meta("name", "description"),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "",
    ogTitle: meta("property", "og:title"),
    ogDescription: meta("property", "og:description"),
    ogImage: absolute(meta("property", "og:image"), pageUrl),
    ogSiteName: meta("property", "og:site_name"),
    // X reads both name= and property= forms of twitter:* tags.
    twitterCard: meta("name", "twitter:card") || meta("property", "twitter:card"),
    twitterTitle: meta("name", "twitter:title") || meta("property", "twitter:title"),
    twitterDescription:
      meta("name", "twitter:description") || meta("property", "twitter:description"),
    twitterImage: absolute(
      meta("name", "twitter:image") || meta("property", "twitter:image"),
      pageUrl,
    ),
  };
}

export interface ResolvedPreviews {
  google: { title: string; description: string; url: string };
  x: { title: string; description: string; image: string; largeCard: boolean; domain: string };
  linkedin: { title: string; image: string; domain: string };
}

/** Effective values each surface renders, using its real fallback chain. */
export function resolvePreviews(tags: PreviewTags, pageUrl: string): ResolvedPreviews {
  let host = pageUrl;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return {
    google: {
      title: tags.title || tags.ogTitle,
      description: tags.metaDescription || tags.ogDescription,
      url: tags.canonical || pageUrl,
    },
    x: {
      title: tags.twitterTitle || tags.ogTitle || tags.title,
      description: tags.twitterDescription || tags.ogDescription || tags.metaDescription,
      image: tags.twitterImage || tags.ogImage,
      largeCard: tags.twitterCard !== "summary", // summary_large_image is X's default render for links with an image
      domain: host,
    },
    linkedin: {
      // LinkedIn only renders og:* (falls back to <title>, ignores meta description in the card).
      title: tags.ogTitle || tags.title,
      image: tags.ogImage,
      domain: host,
    },
  };
}

/** Missing/weak-tags checklist rendered under the previews. */
export function buildTagChecklist(tags: PreviewTags): ToolCheck[] {
  const titleLen = tags.title.length;
  const descLen = tags.metaDescription.length;
  return [
    {
      label: "Title tag",
      state: titleLen === 0 ? "fail" : titleLen >= 30 && titleLen <= 60 ? "pass" : "warn",
      detail: titleLen === 0 ? "missing" : `${titleLen} chars (ideal 30–60)`,
    },
    {
      label: "Meta description",
      state: descLen === 0 ? "fail" : descLen >= 120 && descLen <= 160 ? "pass" : "warn",
      detail: descLen === 0 ? "missing — Google writes its own snippet" : `${descLen} chars (ideal 120–160)`,
    },
    {
      label: "og:title",
      state: tags.ogTitle ? "pass" : "warn",
      detail: tags.ogTitle ? "present" : "missing — shares fall back to the title tag",
    },
    {
      label: "og:description",
      state: tags.ogDescription ? "pass" : "warn",
      detail: tags.ogDescription ? "present" : "missing — shares fall back to meta description",
    },
    {
      label: "og:image",
      state: tags.ogImage ? "pass" : "fail",
      detail: tags.ogImage ? "present" : "missing — shares render as a bare link",
    },
    {
      label: "twitter:card",
      state: tags.twitterCard === "summary_large_image" ? "pass" : "warn",
      detail: tags.twitterCard
        ? tags.twitterCard === "summary_large_image"
          ? "summary_large_image"
          : `${tags.twitterCard} — summary_large_image gets more clicks`
        : "missing — X falls back to og tags",
    },
    {
      label: "Canonical URL",
      state: tags.canonical ? "pass" : "warn",
      detail: tags.canonical ? "present" : "missing",
    },
  ];
}
