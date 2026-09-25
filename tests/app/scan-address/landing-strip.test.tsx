// tests/app/scan-address/landing-strip.test.tsx — issue #1069
//
// SPEC §1 2026-09-24 (owner on #1058): the landing's *Recently scanned*
// strip — logo and company name only, each linking to `/scans`, a letter
// where a site has no logo, and nothing at all rather than a broken landing
// when the list cannot be read. `copy()` is mocked to `(key) => key`.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StripEntry } from "@/lib/scan/gallery";

vi.mock("@/lib/presentation/copy", () => ({ copy: (key: string) => key }));

// A plain answer, not `vi.fn`: a rejecting `vi.fn` that is reset between
// cases reports its rejection against the test even once it is caught.
let answer: () => Promise<readonly StripEntry[]> = async () => [];
vi.mock("@/lib/scan/gallery", () => ({ readRecent: () => answer() }));

const { RecentlyScanned } = await import("@/app/(public)/_landing/RecentlyScanned");

function entries(n: number): StripEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    domain: `site${i}.example`,
    company: i === 0 ? "harbour Bikes" : `Company ${i}`,
    hasLogo: i !== 0,
  }));
}

async function render(): Promise<string> {
  const tree = await RecentlyScanned();
  return tree === null ? "" : renderToStaticMarkup(tree);
}

describe("the landing's Recently scanned strip", () => {
  it("names each company, links every logo to /scans, and draws the site's own icon where there is no stored logo", async () => {
    answer = async () => entries(3);
    const html = await render();
    expect(html).toContain("landing.strip.label");
    expect(html).toContain("landing.strip.all");
    expect(html).not.toMatch(/trusted/i);
    for (const e of entries(3)) expect(html).toContain(e.company);
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(hrefs)).toEqual(new Set(["/scans"]));
    expect(html).toContain('src="/scans/logo/site1.example"');
    expect(html).not.toContain("/scans/logo/site0.example");
    // The letter comes after both icons fail (tests/ui/scans-site-icon.test.tsx).
    expect(html).toContain('src="https://site0.example/apple-touch-icon.png"');
  });

  it("a short list stands still: one copy, nothing hidden", async () => {
    answer = async () => entries(3);
    const html = await render();
    expect(html).not.toContain("animate-drift");
    expect(html).not.toContain('aria-hidden="true" class="flex');
  });

  it("a long list drifts, and its second copy is out of reach of the keyboard and screen readers", async () => {
    answer = async () => entries(10);
    const html = await render();
    expect(html).toContain("motion-safe:animate-drift");
    const lists = [...html.matchAll(/<ul([^>]*)>(.*?)<\/ul>/g)];
    expect(lists).toHaveLength(2);
    expect(lists[0]![1]).not.toContain("aria-hidden");
    expect(lists[1]![1]).toContain('aria-hidden="true"');
    expect(lists[0]![2]).not.toContain("tabindex");
    expect(lists[1]![2]!.match(/<a /g)).toHaveLength(10);
    expect(lists[1]![2]!.match(/tabindex="-1"/g)).toHaveLength(10);
  });

  it("an empty list or a failed read leaves the landing without the strip", async () => {
    answer = async () => [];
    expect(await render()).toBe("");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    answer = async () => {
      throw new Error("down");
    };
    expect(await render()).toBe("");
    quiet.mockRestore();
  });
});
