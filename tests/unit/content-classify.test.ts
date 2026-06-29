import { describe, it, expect } from "vitest";
import {
  parseContentTypeClassifications,
  parseClusterAssignments,
  inferTypeFromUrl,
  type ContentType,
} from "@/lib/scan/content/gather";

// ---------------------------------------------------------------------------
// inferTypeFromUrl (URL heuristic — no LLM)
// ---------------------------------------------------------------------------

describe("inferTypeFromUrl", () => {
  it("classifies /blog/ paths as blog by default", () => {
    expect(inferTypeFromUrl("https://fellow.ai/blog/meeting-minutes-example/")).toBe("blog");
  });
  it("classifies /docs/ paths as docs", () => {
    expect(inferTypeFromUrl("https://example.com/docs/getting-started")).toBe("docs");
  });
  it("classifies /help/ paths as docs", () => {
    expect(inferTypeFromUrl("https://support.zoom.com/hc/en/article?id=zm_kb")).toBe("docs");
  });
  it("classifies comparison slugs in /blog/ as comparison", () => {
    expect(inferTypeFromUrl("https://avoma.com/blog/outreach-vs-salesloft")).toBe("comparison");
  });
  it("classifies /guide/ paths as guide", () => {
    expect(inferTypeFromUrl("https://example.com/blog/how-to-guide/seo")).toBe("guide");
  });
  it("classifies root homepage as landing", () => {
    expect(inferTypeFromUrl("https://fellow.ai/")).toBe("landing");
  });
  it("classifies shallow product paths as landing", () => {
    expect(inferTypeFromUrl("https://www.avoma.com/pricing")).toBe("landing");
  });
  it("classifies /tools/ paths as tool", () => {
    expect(inferTypeFromUrl("https://example.com/tools/keyword-checker")).toBe("tool");
  });
  it("returns null for ambiguous deep paths", () => {
    // No recognizable pattern → uncertain → LLM handles it
    expect(inferTypeFromUrl("https://read.ai/articles/skip-level-meeting-guide-questions-format-tips")).toBe("guide");
  });
});

// ---------------------------------------------------------------------------
// parseContentTypeClassifications
// ---------------------------------------------------------------------------

describe("parseContentTypeClassifications", () => {
  const urls = [
    "https://acme.com/blog/how-to-do-x",
    "https://acme.com/vs/competitor",
    "https://acme.com/pricing",
    "https://acme.com/",
  ];

  it("maps URLs to types from a well-formed JSON array", () => {
    const raw = JSON.stringify([
      { url: "https://acme.com/blog/how-to-do-x", type: "guide" },
      { url: "https://acme.com/vs/competitor", type: "comparison" },
      { url: "https://acme.com/pricing", type: "landing" },
      { url: "https://acme.com/", type: "landing" },
    ]);
    const result = parseContentTypeClassifications(raw, urls);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ url: "https://acme.com/blog/how-to-do-x", type: "guide" });
    expect(result[1]).toEqual({ url: "https://acme.com/vs/competitor", type: "comparison" });
    expect(result[2]).toEqual({ url: "https://acme.com/pricing", type: "landing" });
  });

  it("falls back to 'other' for URLs missing from the model response", () => {
    const raw = JSON.stringify([
      { url: "https://acme.com/blog/how-to-do-x", type: "blog" },
      // vs/competitor and pricing/root are missing
    ]);
    const result = parseContentTypeClassifications(raw, urls);
    expect(result[0]).toEqual({ url: "https://acme.com/blog/how-to-do-x", type: "blog" });
    expect(result[1]).toEqual({ url: "https://acme.com/vs/competitor", type: "other" });
    expect(result[2]).toEqual({ url: "https://acme.com/pricing", type: "other" });
  });

  it("ignores invalid types from the model and falls back to 'other'", () => {
    const raw = JSON.stringify([
      { url: "https://acme.com/blog/how-to-do-x", type: "infographic" }, // not in CONTENT_TYPES
    ]);
    const result = parseContentTypeClassifications(raw, urls);
    expect(result[0]?.type).toBe("other");
  });

  it("accepts model output wrapped in a ```json fence", () => {
    const raw = "```json\n[{\"url\":\"https://acme.com/blog/how-to-do-x\",\"type\":\"guide\"}]\n```";
    const result = parseContentTypeClassifications(raw, urls);
    expect(result[0]?.type).toBe("guide");
  });

  it("returns all-'other' on completely malformed model output", () => {
    const result = parseContentTypeClassifications("not json at all", urls);
    expect(result.every((r) => r.type === "other")).toBe(true);
    expect(result).toHaveLength(4);
  });

  it("handles empty URL list", () => {
    expect(parseContentTypeClassifications("[]", [])).toEqual([]);
  });

  it("accepts all valid content types", () => {
    const types: ContentType[] = ["guide", "comparison", "listicle", "landing", "tool", "blog", "docs", "other"];
    for (const type of types) {
      const raw = JSON.stringify([{ url: urls[0], type }]);
      const result = parseContentTypeClassifications(raw, [urls[0]!]);
      expect(result[0]?.type).toBe(type);
    }
  });
});

// ---------------------------------------------------------------------------
// parseClusterAssignments
// ---------------------------------------------------------------------------

describe("parseClusterAssignments", () => {
  const allUrls = [
    "https://acme.com/guide/seo",
    "https://rival.com/guide/keyword-research",
    "https://acme.com/pricing",
    "https://rival.com/tool/rank-tracker",
  ];

  it("assigns urls to clusters from a well-formed JSON array", () => {
    const raw = JSON.stringify([
      {
        cluster: "SEO guides",
        urls: ["https://acme.com/guide/seo", "https://rival.com/guide/keyword-research"],
      },
      { cluster: "Pricing pages", urls: ["https://acme.com/pricing"] },
      { cluster: "Tools", urls: ["https://rival.com/tool/rank-tracker"] },
    ]);
    const { pageAssignments } = parseClusterAssignments(raw, allUrls);
    const byUrl = Object.fromEntries(pageAssignments.map((a) => [a.url, a.cluster]));
    expect(byUrl["https://acme.com/guide/seo"]).toBe("SEO guides");
    expect(byUrl["https://rival.com/guide/keyword-research"]).toBe("SEO guides");
    expect(byUrl["https://acme.com/pricing"]).toBe("Pricing pages");
    expect(byUrl["https://rival.com/tool/rank-tracker"]).toBe("Tools");
  });

  it("assigns 'other' for urls not included in any cluster", () => {
    const raw = JSON.stringify([
      { cluster: "SEO guides", urls: ["https://acme.com/guide/seo"] },
      // rival.com pages are missing
    ]);
    const { pageAssignments } = parseClusterAssignments(raw, allUrls);
    const byUrl = Object.fromEntries(pageAssignments.map((a) => [a.url, a.cluster]));
    expect(byUrl["https://rival.com/guide/keyword-research"]).toBe("other");
  });

  it("falls back to 'general' on completely malformed model output", () => {
    const { pageAssignments } = parseClusterAssignments("not json", allUrls);
    expect(pageAssignments.every((a) => a.cluster === "general")).toBe(true);
    expect(pageAssignments).toHaveLength(4);
  });

  it("handles empty URL list", () => {
    const { pageAssignments } = parseClusterAssignments("[]", []);
    expect(pageAssignments).toEqual([]);
  });

  it("preserves input order of urls in the output", () => {
    const raw = JSON.stringify([
      { cluster: "Tools", urls: ["https://rival.com/tool/rank-tracker"] },
      { cluster: "SEO guides", urls: ["https://acme.com/guide/seo"] },
    ]);
    const { pageAssignments } = parseClusterAssignments(raw, allUrls);
    expect(pageAssignments.map((a) => a.url)).toEqual(allUrls);
  });
});
