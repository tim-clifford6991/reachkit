import { expect, test } from "vitest";
import { parseRssPage } from "./app-store-rss";

test("parseRssPage maps entries to ReviewItem[]", () => {
  const page = { feed: { entry: [
    { "im:rating": { label: "5" }, title: { label: "Love it" }, content: { label: "Great app" } },
    { "im:rating": { label: "2" }, title: { label: "Meh" }, content: { label: "Crashes a lot" } },
  ] } };
  const out = parseRssPage(page);
  expect(out).toHaveLength(2);
  expect(out[1]).toMatchObject({ rating: 2, title: "Meh", body: "Crashes a lot" });
});

test("parseRssPage tolerates the leading metadata entry (no im:rating)", () => {
  const page = { feed: { entry: [{ title: { label: "App meta" } }, { "im:rating": { label: "4" }, title: { label: "ok" }, content: { label: "fine" } }] } };
  expect(parseRssPage(page)).toHaveLength(1); // entries without a rating are dropped
});
