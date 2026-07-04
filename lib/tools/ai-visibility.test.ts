import { expect, test } from "vitest";
import {
  AI_CRAWLERS,
  aiCrawlerVerdicts,
  aiVisibilityVerdict,
  buildAiVisibilityChecks,
  evaluateRobotsAccess,
  extractAiPageSignals,
  type AiPageSignals,
} from "./ai-visibility";

// ---------------------------------------------------------------------------
// robots.txt parsing
// ---------------------------------------------------------------------------

test("no matching group and no wildcard means allowed", () => {
  const robots = "User-agent: Bingbot\nDisallow: /\n";
  expect(evaluateRobotsAccess(robots, "GPTBot")).toBe("allowed");
});

test("specific group blanket-disallow blocks that crawler only", () => {
  const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n";
  expect(evaluateRobotsAccess(robots, "GPTBot")).toBe("blocked");
  expect(evaluateRobotsAccess(robots, "ClaudeBot")).toBe("allowed");
});

test("wildcard group applies when no specific group exists", () => {
  const robots = "User-agent: *\nDisallow: /admin\n";
  expect(evaluateRobotsAccess(robots, "PerplexityBot")).toBe("limited");
});

test("specific group overrides a blanket wildcard block", () => {
  const robots = "User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /private\n";
  expect(evaluateRobotsAccess(robots, "ClaudeBot")).toBe("limited");
  expect(evaluateRobotsAccess(robots, "GPTBot")).toBe("blocked");
});

test("matching is case-insensitive and shared groups apply to all listed agents", () => {
  const robots = "user-agent: gptbot\nuser-agent: google-extended\ndisallow: /\n";
  expect(evaluateRobotsAccess(robots, "GPTBot")).toBe("blocked");
  expect(evaluateRobotsAccess(robots, "Google-Extended")).toBe("blocked");
  expect(evaluateRobotsAccess(robots, "ClaudeBot")).toBe("allowed");
});

test("comments and empty Disallow lines are ignored", () => {
  const robots = "User-agent: GPTBot # ai crawler\nDisallow: # allow everything\n";
  expect(evaluateRobotsAccess(robots, "GPTBot")).toBe("allowed");
});

test("aiCrawlerVerdicts with null robots.txt allows all four crawlers", () => {
  const verdicts = aiCrawlerVerdicts(null);
  expect(verdicts).toHaveLength(AI_CRAWLERS.length);
  expect(verdicts.every((v) => v.access === "allowed")).toBe(true);
});

// ---------------------------------------------------------------------------
// page signal extraction
// ---------------------------------------------------------------------------

const GOOD_HTML = `
<html><head>
<title>Acme Analytics — product analytics for indie founders</title>
<meta name="description" content="Acme Analytics gives indie founders product analytics with zero setup. Track activation, retention and revenue in one dashboard.">
<meta property="og:description" content="Product analytics for indie founders, zero setup.">
<script type="application/ld+json">{"@type":"SoftwareApplication","name":"Acme"}</script>
</head><body><h1>Product analytics for indie founders</h1></body></html>`;

test("extractAiPageSignals pulls title, h1, descriptions and JSON-LD types", () => {
  const s = extractAiPageSignals(GOOD_HTML);
  expect(s.title).toContain("Acme Analytics");
  expect(s.h1).toBe("Product analytics for indie founders");
  expect(s.metaDescription).toContain("zero setup");
  expect(s.ogDescription).toContain("indie founders");
  expect(s.jsonLdTypes).toEqual(["SoftwareApplication"]);
  expect(s.hasJsonLd).toBe(true);
});

// ---------------------------------------------------------------------------
// checks + verdict
// ---------------------------------------------------------------------------

function pageSignals(overrides: Partial<AiPageSignals> = {}): AiPageSignals {
  return {
    title: "Acme Analytics — product analytics for founders",
    h1: "Product analytics for founders",
    metaDescription:
      "Acme Analytics gives founders product analytics with zero setup and one dashboard.",
    ogDescription: "Product analytics for founders.",
    jsonLdTypes: ["SoftwareApplication"],
    hasJsonLd: true,
    ...overrides,
  };
}

test("a fully healthy site passes all five checks", () => {
  const checks = buildAiVisibilityChecks({
    llmsTxt: { exists: true, text: "# Acme\nProduct analytics." },
    robotsTxt: null,
    page: pageSignals(),
  });
  expect(checks).toHaveLength(5);
  expect(checks.every((c) => c.state === "pass")).toBe(true);
  expect(aiVisibilityVerdict(checks, "acme.com")).toContain("can see and understand");
});

test("missing llms.txt fails and blocked crawlers fail", () => {
  const checks = buildAiVisibilityChecks({
    llmsTxt: { exists: false, text: "" },
    robotsTxt: "User-agent: GPTBot\nDisallow: /\n",
    page: pageSignals(),
  });
  const llms = checks.find((c) => c.label === "llms.txt");
  const access = checks.find((c) => c.label === "AI crawler access");
  expect(llms?.state).toBe("fail");
  expect(access?.state).toBe("fail");
  expect(access?.detail).toContain("GPTBot");
});

test("incoherent title/h1/description warns on proposition", () => {
  const checks = buildAiVisibilityChecks({
    llmsTxt: { exists: true, text: "hi" },
    robotsTxt: null,
    page: pageSignals({
      title: "Welcome home page",
      h1: "Untitled section",
      metaDescription: "Some completely unrelated words about nothing specific.",
      ogDescription: "",
    }),
  });
  const proposition = checks.find((c) => c.label === "Proposition extractable");
  expect(proposition?.state).toBe("warn");
});

test("missing title/h1/description fails the proposition check and worsens the verdict", () => {
  const checks = buildAiVisibilityChecks({
    llmsTxt: { exists: false, text: "" },
    robotsTxt: null,
    page: pageSignals({ title: "", h1: "", metaDescription: "", ogDescription: "", jsonLdTypes: [], hasJsonLd: false }),
  });
  const proposition = checks.find((c) => c.label === "Proposition extractable");
  expect(proposition?.state).toBe("fail");
  expect(aiVisibilityVerdict(checks, "acme.com")).toContain("invisible");
});
