import { expect, test } from "vitest";
import { adaptersFor } from "./select";
test("app mode uses iTunes + review RSS; web mode uses site + serp + ph + domain-age + tavily", () => {
  expect(adaptersFor("ios")).toEqual(expect.arrayContaining(["itunes", "app_store_rss"]));
  expect(adaptersFor("web")).toEqual(expect.arrayContaining(["site_fetch", "dataforseo_serp", "product_hunt", "domain_age", "tavily"]));
  expect(adaptersFor("ios")).not.toContain("product_hunt");
});
