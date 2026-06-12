import { expect, test } from "vitest";
import { classifyUrl } from "./router";

test.each([
  ["https://apps.apple.com/us/app/sofa/id1276554886", "ios"],
  ["https://play.google.com/store/apps/details?id=com.x", "android"],
  ["https://nudgi.app/pricing", "web"],
  ["reachkit.app", "web"],
  ["https://evilapps.apple.com/x", "web"],
  ["https://apps.apple.com.attacker.com/x", "web"],
])("classifyUrl(%s) -> %s", (url, platform) => {
  expect(classifyUrl(url).platform).toBe(platform);
});
test("classifyUrl rejects non-URLs", () => {
  expect(() => classifyUrl("not a url at all !!")).toThrow();
});
