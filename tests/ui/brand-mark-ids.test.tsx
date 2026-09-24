// tests/ui/brand-mark-ids.test.tsx — issue #1060
//
// The app shell draws the mark three times at once (top bar, sidebar,
// rail). If two share a gradient/clip id, `url(#…)` resolves to the first,
// and when that one is hidden the others paint as a plain violet square.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Brand, BrandMark } from "@/app/_brand/Brand";

describe("#1060 — brand marks drawn together never share a paint-server id", () => {
  it("every mark's gradient and clip ids are unique, and each mark references only its own", () => {
    const html = renderToStaticMarkup(
      <div>
        <Brand href="/app" />
        <Brand href="/app" />
        <BrandMark size="lg" />
      </div>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const marks = [...doc.querySelectorAll('[data-testid="brand-mark"]')];
    expect(marks).toHaveLength(3);

    const allIds = [...doc.querySelectorAll("linearGradient, clipPath")].map((n) => n.id);
    expect(allIds).toHaveLength(6);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const mark of marks) {
      const own = new Set([...mark.querySelectorAll("linearGradient, clipPath")].map((n) => n.id));
      const refs = [...mark.querySelectorAll("*")]
        .flatMap((n) => [n.getAttribute("fill"), n.getAttribute("clip-path")])
        .map((v) => /^url\(#([^)]+)\)$/.exec(v ?? "")?.[1])
        .filter((v): v is string => v !== undefined);
      expect(refs).toHaveLength(2);
      for (const ref of refs) expect(own.has(ref)).toBe(true);
    }
  });
});
