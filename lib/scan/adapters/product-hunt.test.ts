import { expect, test } from "vitest";
import { parsePhPosts } from "./product-hunt";

test("parsePhPosts extracts votes + neighbour products", () => {
  const data = { data: { posts: { edges: [
    { node: { name: "Nudgi", votesCount: 320, url: "https://www.producthunt.com/posts/nudgi", reviewsCount: 12 } },
    { node: { name: "Habitify", votesCount: 980, url: "https://www.producthunt.com/posts/habitify", reviewsCount: 40 } },
  ] } } };
  const r = parsePhPosts(data, "Nudgi");
  expect(r.selfUpvotes).toBe(320);
  expect(r.neighbours.map((n) => n.name)).toContain("Habitify");
});
test("parsePhPosts returns zeros/empty when the product isn't on PH", () => {
  const r = parsePhPosts({ data: { posts: { edges: [] } } }, "ObscureSaaS");
  expect(r.selfUpvotes).toBe(0);
  expect(r.neighbours).toEqual([]);
});
