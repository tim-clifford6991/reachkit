import { expect, test } from "vitest";
import { classifyUrl } from "./router";

test.each([
  ["https://apps.apple.com/us/app/sofa/id1276554886", "ios"],
  ["https://play.google.com/store/apps/details?id=com.x", "android"],
  ["https://nudgi.app/pricing", "web"],
  ["reachkit.app", "web"],
  // Scheme-less input — users may type a bare domain; the form no longer forces a
  // full URL, so the router must normalise these (router.ts prepends https://).
  ["apple.com", "web"],
  ["apps.apple.com/us/app/sofa/id1276554886", "ios"],
  ["play.google.com/store/apps/details?id=com.x", "android"],
  ["https://evilapps.apple.com/x", "web"],
  ["https://apps.apple.com.attacker.com/x", "web"],
])("classifyUrl(%s) -> %s", (url, platform) => {
  expect(classifyUrl(url).platform).toBe(platform);
});
test("classifyUrl rejects non-URLs", () => {
  expect(() => classifyUrl("not a url at all !!")).toThrow();
});
