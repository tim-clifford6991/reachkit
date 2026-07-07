import { describe, expect, it, test } from "vitest";
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

describe("classifyUrl web canonicalization", () => {
  const web = (u: string) => classifyUrl(u).url;
  it("collapses www, path, query, case, and trailing slash to one origin", () => {
    for (const input of [
      "nudgi.ai", "nudgi.ai/", "https://nudgi.ai", "https://nudgi.ai/",
      "www.nudgi.ai", "https://www.nudgi.ai/", "NUDGI.ai",
      "https://nudgi.ai/pricing", "https://www.nudgi.ai/pricing/?utm=x#top",
    ]) {
      expect(web(input)).toBe("https://nudgi.ai/");
    }
  });
  it("keeps app-store URLs intact (the app id lives in the path)", () => {
    const r = classifyUrl("https://apps.apple.com/us/app/x/id123");
    expect(r.platform).toBe("ios");
    expect(r.url).toContain("id123");
  });
});
