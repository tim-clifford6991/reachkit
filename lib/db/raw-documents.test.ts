import { expect, test } from "vitest";
import { contentHash } from "./raw-documents";

test("contentHash is stable and order-independent at the top level", () => {
  expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
});
test("contentHash is order-independent for NESTED objects too", () => {
  expect(contentHash({ x: { a: 1, b: 2 } })).toBe(contentHash({ x: { b: 2, a: 1 } }));
});
test("contentHash differs for different content", () => {
  expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
});
