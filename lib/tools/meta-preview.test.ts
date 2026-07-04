import { expect, test } from "vitest";
import { buildTagChecklist, extractPreviewTags, resolvePreviews } from "./meta-preview";

const FULL_HTML = `
<html><head>
<title>Acme Analytics — product analytics for indie founders</title>
<meta name="description" content="Acme Analytics gives indie founders product analytics with zero setup. Track activation, retention and revenue in one clean dashboard today.">
<link rel="canonical" href="https://acme.com/">
<meta property="og:title" content="Acme Analytics">
<meta property="og:description" content="Product analytics for indie founders.">
<meta property="og:image" content="/og.png">
<meta property="og:site_name" content="Acme">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Acme on X">
</head><body></body></html>`;

test("extractPreviewTags reads every tag and resolves relative og:image", () => {
  const tags = extractPreviewTags(FULL_HTML, "https://acme.com/pricing");
  expect(tags.title).toContain("Acme Analytics");
  expect(tags.canonical).toBe("https://acme.com/");
  expect(tags.ogImage).toBe("https://acme.com/og.png");
  expect(tags.ogSiteName).toBe("Acme");
  expect(tags.twitterCard).toBe("summary_large_image");
  expect(tags.twitterTitle).toBe("Acme on X");
  expect(tags.twitterImage).toBe("");
});

test("twitter tags in property= form are also read", () => {
  const tags = extractPreviewTags(
    `<head><meta property="twitter:card" content="summary"></head>`,
    "https://acme.com/",
  );
  expect(tags.twitterCard).toBe("summary");
});

test("resolvePreviews applies each surface's fallback chain", () => {
  const tags = extractPreviewTags(FULL_HTML, "https://www.acme.com/pricing");
  const p = resolvePreviews(tags, "https://www.acme.com/pricing");
  expect(p.google.title).toContain("Acme Analytics —");
  expect(p.google.url).toBe("https://acme.com/"); // canonical wins
  expect(p.x.title).toBe("Acme on X"); // twitter:title wins
  expect(p.x.description).toBe("Product analytics for indie founders."); // falls back to og
  expect(p.x.image).toBe("https://www.acme.com/og.png"); // falls back to og:image, resolved against the page URL
  expect(p.x.largeCard).toBe(true);
  expect(p.x.domain).toBe("acme.com"); // www stripped
  expect(p.linkedin.title).toBe("Acme Analytics"); // og:title only
});

test("empty page falls back gracefully", () => {
  const tags = extractPreviewTags("<html><head></head><body></body></html>", "https://acme.com/");
  const p = resolvePreviews(tags, "https://acme.com/");
  expect(p.google.title).toBe("");
  expect(p.google.url).toBe("https://acme.com/");
  expect(p.linkedin.image).toBe("");
});

test("checklist grades missing and weak tags", () => {
  const empty = buildTagChecklist(
    extractPreviewTags("<html><head><title>Hi</title></head></html>", "https://acme.com/"),
  );
  expect(empty.find((c) => c.label === "Title tag")?.state).toBe("warn"); // present but short
  expect(empty.find((c) => c.label === "Meta description")?.state).toBe("fail");
  expect(empty.find((c) => c.label === "og:image")?.state).toBe("fail");
  expect(empty.find((c) => c.label === "twitter:card")?.state).toBe("warn");

  const full = buildTagChecklist(extractPreviewTags(FULL_HTML, "https://acme.com/"));
  expect(full.find((c) => c.label === "Title tag")?.state).toBe("pass");
  expect(full.find((c) => c.label === "Meta description")?.state).toBe("pass");
  expect(full.find((c) => c.label === "og:image")?.state).toBe("pass");
  expect(full.find((c) => c.label === "twitter:card")?.state).toBe("pass");
  expect(full.find((c) => c.label === "Canonical URL")?.state).toBe("pass");
});
