import { expect, test } from "vitest";
import { parseListingHtml } from "./site-fetch";

test("parseListingHtml pulls title, meta description, h1", () => {
  const html = `<html><head><title>Nudgi — habit nudges</title>
    <meta name="description" content="Gentle reminders that build habits"></head>
    <body><h1>Build habits without willpower</h1></body></html>`;
  const r = parseListingHtml(html, "https://nudgi.app");
  expect(r.name).toContain("Nudgi");
  expect(r.description).toBe("Gentle reminders that build habits");
});
test("parseListingHtml falls back to hostname when no title, and h1 when no meta", () => {
  const r = parseListingHtml(`<html><body><h1>Just an H1</h1></body></html>`, "https://example.com/x");
  expect(r.name).toBe("example.com");
  expect(r.description).toBe("Just an H1");
});

test("parseListingHtml does not throw on a non-absolute url and uses it as-is for the name", () => {
  const r = parseListingHtml("<html></html>", "not-an-absolute-url");
  expect(r.name).toBe("not-an-absolute-url");
});
