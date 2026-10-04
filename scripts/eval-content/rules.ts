// scripts/eval-content/rules.ts — issue 1187: each hard rule's false-positive
// rate, measured on stored text. No model, no vendor, nothing spent.
//
// Three stored sets, and the fifteen deterministic rules run over each as the
// battery runs them (`runDeterministicRules`):
//
//   1. **Stored drafts.** Every draft the product has written, read from
//      `drafts` through the connector on the date in `index.json` and kept
//      under `stored-drafts/<domain>/`: the body as stored, the title, the
//      target, the facts the row recorded and the rules the product recorded.
//   2. **Evaluation drafts.** The ten pages #1153 kept under
//      `docs/walk/ab-reachkit/`: today's pipeline (A), the prototype of the
//      2026-09-29 rulings before and after its critic (B), and the
//      hand-written reference (C).
//   3. **The evaluation set's own pages.** Each snapshot's page text, block by
//      block: what a rule does to a sentence the customer's site states, which
//      a page may carry word for word.
//
// A rule firing is not a false positive until somebody has read the page.
// `stored-drafts/verdicts.json` holds that reading, per page and rule: a
// violation the rule exists for, or a false positive, with the reason. A fire
// nobody has judged counts as a false positive, so a rule cannot look better
// than it was read to be.
//
// `--baseline` stores this run's fires as the "before" the table is compared
// with; it was taken on `main` before the rules changed. The one committed
// output is `docs/walk/rule-review.md`. A tool, not a gate.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixNotes } from "@/lib/generate/pipeline/repair";
import { runDeterministicRules } from "@/lib/generate/rules";
import { renderOf, sourceBlocksOf } from "@/lib/generate/rules/text";
import { HARD_RULES, type ComparisonSet, type HardRule, type ModelRule } from "@/lib/generate/rules/types";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import type { OpportunityType } from "@/lib/opportunities/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { EVAL_SET } from "./set";
import { readSnapshot, type Snapshot } from "./snapshot";

export interface RulesOptions {
  root: string;
  tablePath: string;
  baseline: boolean;
}

type Deterministic = Exclude<HardRule, ModelRule>;
const RULES = HARD_RULES.filter((rule): rule is Deterministic => rule !== "do_not_claim" && rule !== "fit_claim");

interface Page {
  /** Stable across runs: the key verdicts and the baseline are held under. */
  id: string;
  set: "stored" | "evaluation";
  domain: string;
  title: string;
  markdown: string;
  type: OpportunityType;
  queries: string[];
  facts: string[];
  grounded: { url: string; passage: string } | null;
  /** A row written before `meta.factsUsed` existed kept one passage, not the
   *  set the brief chose: whether a number traces to a fact cannot be asked
   *  of it, and `traceable_numerals` is not counted there. */
  factsKnown: boolean;
  /** What the product recorded when it wrote the page, where it did. */
  recorded: string[] | null;
}

interface StoredIndex {
  domain: string;
  readOn: string;
  rivals: string[];
  doNotClaim: string[];
  drafts: {
    file: string;
    type: OpportunityType;
    query: string;
    absorbed: string[];
    title: string;
    factUrl: string;
    grounded: string;
    facts: string[] | null;
    recorded: string[];
  }[];
}

type Verdicts = Record<string, Record<string, { falsePositive: boolean; why: string }>>;
/** Page id → the rules that fired on it. */
type Fires = Record<string, string[]>;
interface Baseline {
  takenAt: string;
  pages: Fires;
  ownPages: Record<string, Record<string, number>>;
}

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STORED_DIR = path.join(HERE, "stored-drafts");

/** The ten kept pages of #1153, with the search each was written for
 *  (`docs/walk/ab-reachkit/blind/key.md`). */
const EVALUATION_PAGES: { file: string; query: string; type: OpportunityType }[] = [
  { file: "A1.md", query: "best ai seo software", type: "listed_page" },
  { file: "A2.md", query: "best seo software review", type: "listed_page" },
  { file: "A3.md", query: "what is the best seo software", type: "listed_page" },
  { file: "B1-before-critic.md", query: "best ai seo software", type: "listed_page" },
  { file: "B1.md", query: "best ai seo software", type: "listed_page" },
  { file: "B2-before-critic.md", query: "what is the best seo software", type: "listed_page" },
  { file: "B2.md", query: "what is the best seo software", type: "listed_page" },
  { file: "B3-before-critic.md", query: "how to get found by chatgpt and google ai", type: "answer_page" },
  { file: "B3.md", query: "how to get found by chatgpt and google ai", type: "answer_page" },
  { file: "C-reference.md", query: "why does chatgpt recommend my competitors", type: "answer_page" },
];

function storedPages(): { index: StoredIndex; pages: Page[] }[] {
  return readdirSync(STORED_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(STORED_DIR, entry.name);
      const index = JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")) as StoredIndex;
      const pages = index.drafts.map((draft): Page => ({
        id: `${index.domain}/${draft.file}`,
        set: "stored",
        domain: index.domain,
        title: draft.title,
        markdown: readFileSync(path.join(dir, draft.file), "utf8").replace(/\n$/, ""),
        type: draft.type,
        queries: [draft.query, ...draft.absorbed],
        // A row written before `meta.factsUsed` existed recorded its one
        // grounded passage and nothing else.
        facts: draft.facts ?? [draft.grounded],
        grounded: { url: draft.factUrl, passage: draft.grounded },
        factsKnown: draft.facts !== null,
        recorded: draft.recorded,
      }));
      return { index, pages };
    });
}

/** A kept page opens with a comment saying which arm it is; the pipeline
 *  wrote none of that. Its title is its first heading. */
function evaluationPages(root: string, snapshot: Snapshot): Page[] {
  const dir = path.join(root, "docs/walk/ab-reachkit");
  return EVALUATION_PAGES.map((kept): Page => {
    const markdown = readFileSync(path.join(dir, kept.file), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "").trimEnd();
    return {
      id: `ab-reachkit/${kept.file}`,
      set: "evaluation",
      domain: snapshot.domain,
      title: /^#\s+(.+)$/m.exec(markdown)?.[1] ?? kept.query,
      markdown,
      type: kept.type,
      queries: [kept.query],
      // The facts each page was handed were not kept. The business pool it
      // chose from is the snapshot's pages; its market facts stand beside
      // their links.
      facts: snapshot.pages.map((page) => page.text),
      grounded: null,
      factsKnown: true,
      recorded: null,
    };
  });
}

function brandOf(report: StoredReport): string | null {
  return report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);
}

function firesOn(
  page: Page,
  a: { report: StoredReport; snapshot: Snapshot; rivals: string[]; earlier: Page[] }
): { rules: Deterministic[]; sentences: Record<string, string[]> } {
  const source = page.grounded === null ? undefined : a.snapshot.pages.find((p) => p.url === page.grounded!.url);
  const comparison: ComparisonSet = {
    published: a.earlier
      .filter((other) => other.recorded !== null && other.recorded.length === 0)
      .map((other) => ({ ref: other.id, title: other.title, rendered: renderOf(other.markdown) })),
    measured: a.snapshot.pages.map((p) => ({ ref: p.url, title: p.title, rendered: p.text })),
    queued: [],
  };
  const brief = { facts: page.facts, queries: page.queries };
  const site = { businessName: brandOf(a.report), domain: page.domain };
  const outcome = runDeterministicRules({
    markdown: page.markdown,
    title: page.title,
    rendered: renderOf(page.markdown),
    pageType: pageTypeOf({ type: page.type, targetQuery: page.queries[0] ?? null }),
    site: {
      businessName: brandOf(a.report),
      domain: page.domain,
      doNotClaim: [],
      rivals: a.rivals,
    },
    comparison,
    // The page a passage was read from has changed since: where the snapshot
    // no longer holds it, the passage is taken as read, as the row's trigger
    // froze it. A page with no recorded passage is not judged on grounding.
    grounded: page.grounded === null ? { url: "", readAt: new Date(0), passage: "kept" } : { ...page.grounded, readAt: new Date(0) },
    sourceText:
      page.grounded === null ? "kept" : source?.text.includes(page.grounded.passage) === true ? source.text : page.grounded.passage,
    brief,
  });
  const rules = RULES.filter((rule) => outcome[rule] !== null && (rule !== "traceable_numerals" || page.factsKnown));
  const notes = fixNotes(page.markdown, rules.map((rule) => outcome[rule]!), brief, site);
  return { rules, sentences: Object.fromEntries(notes.map((note) => [note.rule, note.sentences])) };
}

/** Each block of a site's own pages, as a page that carries it word for word:
 *  the block is the body and the one fact. Counted per rule that can read a
 *  single block. */
const BLOCK_RULES: readonly string[] = [
  "no_private_figure",
  "no_invented_people",
  "no_unsourced_testimonial",
  "no_hidden_text",
  "no_machine_address",
];

function ownPageFires(domain: string): { blocks: number; fires: Record<string, number>; samples: Record<string, string[]> } {
  const snapshot = readSnapshot(domain);
  const report = readStoredReport(snapshot.report);
  const rivals = report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain);
  const fires: Record<string, number> = {};
  const samples: Record<string, string[]> = {};
  let blocks = 0;
  const seen = new Set<string>();
  for (const page of snapshot.pages) {
    // A page's text is one run of words; its sentences are the blocks.
    for (const block of page.text.split(/(?<=[.!?])\s+/).flatMap((s) => sourceBlocksOf(s)).map((b) => b.raw)) {
      if (block.length < 25 || seen.has(block)) continue;
      seen.add(block);
      blocks += 1;
      const outcome = runDeterministicRules({
        markdown: block,
        title: "",
        rendered: block,
        pageType: null,
        site: { businessName: brandOf(report), domain, doNotClaim: [], rivals },
        comparison: { published: [], measured: [], queued: [] },
        grounded: { url: page.url, readAt: new Date(page.readAt), passage: block },
        sourceText: block,
        brief: { facts: [block], queries: [] },
      });
      for (const rule of BLOCK_RULES) {
        if ((outcome as Record<string, unknown>)[rule] == null) continue;
        fires[rule] = (fires[rule] ?? 0) + 1;
        if ((samples[rule] ??= []).length < 6) samples[rule]!.push(block.slice(0, 160));
      }
    }
  }
  return { blocks, fires, samples };
}

const pct = (n: number, of: number): string => (of === 0 ? "—" : `${((100 * n) / of).toFixed(0)}%`);

export async function main(opts: RulesOptions): Promise<number> {
  const stored = storedPages();
  const pages: Page[] = [];
  const fires: Fires = {};
  const sentences: Record<string, Record<string, string[]>> = {};
  const measure = (page: Page, a: Parameters<typeof firesOn>[1]): void => {
    const fired = firesOn(page, a);
    fires[page.id] = fired.rules;
    sentences[page.id] = fired.sentences;
  };
  for (const { index, pages: drafts } of stored) {
    const snapshot = readSnapshot(index.domain);
    const report = readStoredReport(snapshot.report);
    const kept = index.domain === "reachkit.app" ? evaluationPages(opts.root, snapshot) : [];
    drafts.forEach((page, at) => {
      measure(page, { report, snapshot, rivals: index.rivals, earlier: drafts.slice(0, at) });
    });
    for (const page of kept) measure(page, { report, snapshot, rivals: index.rivals, earlier: [] });
    pages.push(...drafts, ...kept);
  }

  const domains = EVAL_SET.flatMap((slot) => (slot.domain !== null && existsSync(path.join(HERE, "snapshot", `${slot.domain}.json`)) ? [slot.domain] : []));
  const own = Object.fromEntries(domains.map((domain) => [domain, ownPageFires(domain)]));

  const baselinePath = path.join(STORED_DIR, "baseline.json");
  if (opts.baseline) {
    const baseline: Baseline = {
      takenAt: new Date().toISOString().slice(0, 10),
      pages: fires,
      ownPages: Object.fromEntries(Object.entries(own).map(([domain, o]) => [domain, { blocks: o.blocks, ...o.fires }])),
    };
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    for (const page of pages) console.log(`${page.id}: ${fires[page.id]!.join(", ") || "passes"}`);
    for (const [domain, o] of Object.entries(own)) {
      console.log(`\n${domain}: ${o.blocks} blocks; ${JSON.stringify(o.fires)}`);
      for (const [rule, lines] of Object.entries(o.samples)) for (const line of lines) console.log(`  ${rule}: ${line}`);
    }
    console.log(`\nBaseline stored at ${path.relative(opts.root, baselinePath)}.`);
    return 0;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
  const verdicts = JSON.parse(readFileSync(path.join(STORED_DIR, "verdicts.json"), "utf8")) as Verdicts;
  const purposes = JSON.parse(readFileSync(path.join(STORED_DIR, "purposes.json"), "utf8")) as Record<
    string,
    { guards: string; decision: string }
  >;

  // The baseline was taken before a page said whether its facts were kept.
  for (const page of pages) {
    if (!page.factsKnown) baseline.pages[page.id] = (baseline.pages[page.id] ?? []).filter((rule) => rule !== "traceable_numerals");
  }
  const isFalse = (id: string, rule: string): boolean => verdicts[id]?.[rule]?.falsePositive !== false;
  const tally = (set: Page["set"], from: Fires, rule: string): { fired: number; wrong: number; of: number } => {
    const inSet = pages.filter((page) => page.set === set);
    const fired = inSet.filter((page) => (from[page.id] ?? []).includes(rule));
    return { fired: fired.length, wrong: fired.filter((page) => isFalse(page.id, rule)).length, of: inSet.length };
  };

  const passing = (set: Page["set"], from: Fires): number =>
    pages.filter((page) => page.set === set && (from[page.id] ?? []).length === 0).length;
  const storedCount = pages.filter((page) => page.set === "stored").length;
  const keptCount = pages.filter((page) => page.set === "evaluation").length;
  const lines: string[] = [
    "# The hard rules, reviewed",
    "",
    `Written by \`node scripts/eval-content.mjs --rules\` on ${new Date().toISOString().slice(0, 10)} (issue 1187; owner ruling D27, SPEC §7 2026-10-02). A tool, not a gate. Nothing was spent: the rules are code, run again over stored text.`,
    "",
    `**What was measured.** ${storedCount} stored drafts (every draft the product has written, all for reachkit.app, read on ${stored[0]?.index.readOn ?? "—"}), ${keptCount} evaluation drafts (the pages #1153 kept under \`docs/walk/ab-reachkit/\`), and every block of the evaluation set's own pages across ${domains.length} sites. *Before* is \`main\` on ${baseline.takenAt}, before this issue changed a rule.`,
    "",
    "**How a false positive is counted.** A rule that fires is read against the page. It is a violation where the page does what the rule exists to stop, and a false positive otherwise; each reading and its reason is in `scripts/eval-content/stored-drafts/verdicts.json`. A fire nobody has read counts as a false positive. The rate is false positives over all pages in the set.",
    "",
    `**Result.** After the change no rule fires wrongly on any of the ${storedCount + keptCount} pages. Pages no deterministic rule stops: stored ${passing("stored", baseline.pages)} of ${storedCount} before, ${passing("stored", fires)} after; evaluation ${passing("evaluation", baseline.pages)} of ${keptCount} before, ${passing("evaluation", fires)} after. Since #1136 the five stored adverts are no longer a deterministic rule's to stop: \`honest_row\` stops the one that ranks the business in its title, and the fit check — a model call, not re-run here — stopped four of the five on 2026-10-03 (\`fit_claim\`, below).`,
    "",
    "## Each rule: what it guards, and how often it was wrong",
    "",
    `| Rule | Guards | Stored drafts: fired · false, before | after | Evaluation drafts: fired · false, before | after | False-positive rate after, all ${storedCount + keptCount} | Decision |`,
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const rule of HARD_RULES) {
    const purpose = purposes[rule]!;
    if (rule === "do_not_claim" || rule === "fit_claim") {
      lines.push(`| \`${rule}\` | ${purpose.guards} | not re-run: it is a model call | — | not re-run | — | — | ${purpose.decision} |`);
      continue;
    }
    const cell = (t: { fired: number; wrong: number; of: number }): string => `${t.fired} · ${t.wrong} (${pct(t.wrong, t.of)})`;
    const after = [tally("stored", fires, rule), tally("evaluation", fires, rule)] as const;
    lines.push(
      `| \`${rule}\` | ${purpose.guards} | ${cell(tally("stored", baseline.pages, rule))} | ${cell(after[0])} | ${cell(tally("evaluation", baseline.pages, rule))} | ${cell(after[1])} | ${pct(after[0].wrong + after[1].wrong, after[0].of + after[1].of)} | ${purpose.decision} |`
    );
  }
  for (const [rule, purpose] of Object.entries(purposes)) {
    if ((HARD_RULES as readonly string[]).includes(rule)) continue;
    const before = [tally("stored", baseline.pages, rule), tally("evaluation", baseline.pages, rule)] as const;
    lines.push(
      `| \`${rule}\` | ${purpose.guards} | ${before[0].fired} · ${before[0].wrong} (${pct(before[0].wrong, before[0].of)}) | removed | ${before[1].fired} · ${before[1].wrong} (${pct(before[1].wrong, before[1].of)}) | removed | — | ${purpose.decision} |`
    );
  }

  lines.push(
    "",
    "## Page by page",
    "",
    "| Page | Target search | Recorded by the product | Before | After | Reading of what still fires |",
    "|---|---|---|---|---|---|"
  );
  for (const page of pages) {
    const now = fires[page.id] ?? [];
    const reading = now
      .map((rule) => {
        const verdict = verdicts[page.id]?.[rule];
        return `\`${rule}\`: ${verdict === undefined ? "not read — counted as a false positive" : `${verdict.falsePositive ? "false positive" : "violation"} — ${verdict.why}`}`;
      })
      .join("<br>");
    lines.push(
      `| ${page.id} | ${page.queries[0]} | ${page.recorded === null ? "—" : page.recorded.join(", ") || "passed"} | ${(baseline.pages[page.id] ?? []).join(", ") || "passes"} | ${now.join(", ") || "passes"} | ${reading} |`
    );
  }

  lines.push(
    "",
    "## The sites' own sentences",
    "",
    "Each block of a site's own pages, taken as a page that states it word for word with that block as its fact. A fire here is a rule stopping something the customer's own public page says. Before → after.",
    "",
    `| Site | Blocks | ${BLOCK_RULES.map((rule) => `\`${rule}\``).join(" | ")} |`,
    `|---|---|${BLOCK_RULES.map(() => "---").join("|")}|`
  );
  for (const domain of domains) {
    const o = own[domain]!;
    const was = baseline.ownPages[domain] ?? {};
    lines.push(`| ${domain} | ${o.blocks} | ${BLOCK_RULES.map((rule) => `${was[rule] ?? 0} → ${o.fires[rule] ?? 0}`).join(" | ")} |`);
  }
  lines.push(
    "",
    "## What this cannot say",
    "",
    "- Every draft and every evaluation draft is for reachkit.app. The other five sites are measured on their own pages only, because no draft of theirs was kept; writing new ones is a model call, which D34 keeps out of this issue.",
    "- A draft's outline is not stored, so `no_new_question_heading` could not be re-run on any page, and the evaluation drafts' facts are the snapshot's pages rather than the passages each was handed.",
    "- `near_duplicate` is compared with the stored drafts that passed before it and the site's measured pages, not with the set that stood on the day.",
    "- `do_not_claim` is a model call and reachkit.app's list is empty; it was not re-run.",
    ""
  );
  writeFileSync(opts.tablePath, lines.join("\n"));
  for (const page of pages) {
    console.log(`${page.id}: ${fires[page.id]!.join(", ") || "passes"}`);
    for (const [rule, broke] of Object.entries(sentences[page.id] ?? {})) for (const line of broke) console.log(`    ${rule}: ${line.slice(0, 220)}`);
  }
  for (const [domain, o] of Object.entries(own)) {
    console.log(`\n${domain}: ${o.blocks} blocks; ${JSON.stringify(o.fires)}`);
    for (const [rule, samples] of Object.entries(o.samples)) for (const line of samples) console.log(`  ${rule}: ${line}`);
  }
  console.log(`\nWrote ${path.relative(opts.root, opts.tablePath)}.`);
  return 0;
}
