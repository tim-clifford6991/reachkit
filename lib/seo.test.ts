import { expect, test } from "vitest";
import { softwareApplicationLd, buildMetadata } from "./seo";

test("softwareApplicationLd emits valid schema.org shape", () => {
  const ld = softwareApplicationLd({ name: "ReachKit", url: "https://reachkit.app", priceUsd: 29 });
  expect(ld["@type"]).toBe("SoftwareApplication");
  expect(ld.offers.price).toBe("29");
});
test("buildMetadata sets canonical + OG title", () => {
  const m = buildMetadata({ title: "Pricing", path: "/pricing" });
  expect(m.alternates?.canonical).toBe("https://reachkit.app/pricing");
  expect(m.openGraph?.title).toContain("Pricing");
});
