/**
 * CRITIC Gate v2 (Task 8 — §9.2)
 *
 * Enforces 10 quality rules per ActionCard in three layers:
 *   Deterministic (pure code): rules 1, 3, 4, 5a, 7a, 9, 10
 *   LLM (one Sonnet call per card):  rules 2, 5b, 8  — SKIPPED in fixture mode (treated as pass)
 *   check_link (L-tool spot-check): rule 7b            — SKIPPED in fixture mode (treated as pass)
 *
 * Entry points:
 *   runCritic(ctx, card)          — single card; returns pass/fail + possibly LLM-revised card
 *   criticGateCard(ctx, card, 3)  — reject/revise loop; downgrade or drop on exhaustion
 *   runCriticGate(ctx, actions)   — plan-level; runs all cards + source-diversity rule (6)
 */

import { callModel } from "@/lib/llm/anthropic";
import { checkLink } from "@/lib/llm/check-link";
import { CRITIC_SYSTEM, buildCriticPrompt } from "@/lib/llm/prompts";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import type { ActionCard } from "@/lib/llm/types";
import type { ScanContext } from "@/lib/scan/pipeline";

const CRITIC_MODEL = "claude-sonnet-4-6" as const;

// ---------------------------------------------------------------------------
// CriticResult — what runCritic returns
// ---------------------------------------------------------------------------
export interface CriticResult {
  pass: boolean;
  failedRules: string[];
  card: ActionCard; // possibly LLM-revised
}

// ---------------------------------------------------------------------------
// LLM critic response shape
// ---------------------------------------------------------------------------
interface CriticLlmResponse {
  specificityOk: boolean;
  draftCitesFact: boolean;
  audienceHonest: boolean;
  revised?: ActionCard;
}

// ---------------------------------------------------------------------------
// Deterministic rule checks (no LLM, no network)
// ---------------------------------------------------------------------------
function checkDeterministic(card: ActionCard): string[] {
  const failed: string[] = [];

  // Rule 1 — Evidence: ≥2 items AND ≥2 distinct sourceTypes
  const sourceTypes = new Set(card.evidence.map((e) => e.sourceType));
  if (card.evidence.length < 2 || sourceTypes.size < 2) {
    failed.push("evidence");
  }

  // Rule 3 — Effort + deadline
  if (card.effortMin <= 0) {
    failed.push("effort");
  }
  const dl = new Date(card.suggestedDeadline);
  if (isNaN(dl.getTime())) {
    failed.push("deadline");
  }

  // Rule 4 — Expected outcome
  if (!card.expectedOutcome.scoreComponent || !Number.isFinite(card.expectedOutcome.delta)) {
    failed.push("expected_outcome");
  }

  // Rule 5a — Draft present for content/outreach
  if (card.category === "content" || card.category === "outreach") {
    const d = card.draft;
    if (d === null || d.trim().length < 10) {
      failed.push("draft_missing");
    }
  }

  // Rule 7a — Confidence cap for probability_based
  if (card.basis === "probability_based" && card.confidence > 0.6) {
    failed.push("confidence_cap");
  }

  // Rule 9 — Algorithm safety: draftRequiresEdit must be true
  if (card.draftRequiresEdit !== true) {
    failed.push("draft_requires_edit");
  }

  // Rule 10 — Score linkage: exactly one scoreComponent (non-empty string)
  if (
    typeof card.expectedOutcome.scoreComponent !== "string" ||
    card.expectedOutcome.scoreComponent.trim().length === 0
  ) {
    // Already caught by rule 4; add linkage rule separately for clarity
    if (!failed.includes("expected_outcome")) {
      failed.push("score_linkage");
    }
  }

  return failed;
}

// ---------------------------------------------------------------------------
// Parse the LLM's critic JSON response — null on failure (treated as all-pass)
// ---------------------------------------------------------------------------
function parseCriticResponse(raw: string): CriticLlmResponse | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj["specificityOk"] !== "boolean") return null;
    if (typeof obj["draftCitesFact"] !== "boolean") return null;
    if (typeof obj["audienceHonest"] !== "boolean") return null;
    return {
      specificityOk: obj["specificityOk"],
      draftCitesFact: obj["draftCitesFact"],
      audienceHonest: obj["audienceHonest"],
      revised: obj["revised"] as ActionCard | undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build a brief fact context string to anchor critic revisions
// ---------------------------------------------------------------------------
function buildFactContext(card: ActionCard): string {
  const lines: string[] = [];
  for (const ev of card.evidence) {
    lines.push(`[${ev.sourceType}] ${ev.excerpt} (source: ${ev.source})`);
  }
  if (lines.length === 0) lines.push("(no inline evidence available)");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// runCritic — the core single-card gate
// ---------------------------------------------------------------------------
export async function runCritic(ctx: ScanContext, card: ActionCard): Promise<CriticResult> {
  const failedRules: string[] = checkDeterministic(card);

  // --- LLM check (rules 2, 5b, 8) — skip in fixture mode ---
  let currentCard = card;

  if (!fixturesEnabled()) {
    const factContext = buildFactContext(card);
    let llmResponse: CriticLlmResponse | null = null;

    try {
      const result = await callModel({
        model: CRITIC_MODEL,
        system: CRITIC_SYSTEM,
        prompt: buildCriticPrompt({ card, factContext }),
        scanId: ctx.scanId,
        stage: "critic",
        maxTokens: 1024,
      });
      llmResponse = parseCriticResponse(result.text);
    } catch {
      // LLM failure — treat all LLM rules as pass (fail-open for LLM errors)
      llmResponse = null;
    }

    if (llmResponse !== null) {
      if (!llmResponse.specificityOk) failedRules.push("specificity");
      if (!llmResponse.draftCitesFact) failedRules.push("draft_cites_fact");
      if (!llmResponse.audienceHonest) failedRules.push("audience_honest");

      // Apply LLM revision if provided and there are failures
      if (failedRules.length > 0 && llmResponse.revised !== undefined) {
        // Coerce the revised card to maintain §11 invariants
        currentCard = {
          ...llmResponse.revised,
          draftRequiresEdit: true,
          evidenceIds: card.evidenceIds,
          evidence: llmResponse.revised.evidence ?? card.evidence,
          verification: {
            method: llmResponse.revised.verification?.method ?? card.verification.method,
            state: "pending",
          },
          confidence: Math.max(0, Math.min(1, Number(llmResponse.revised.confidence ?? card.confidence))),
        };
      }
    }

    // --- check_link (rule 7b) — spot-check up to 2 http(s) evidence items ---
    // Use currentCard (the possibly-revised card) so entailment is checked against
    // the revision's evidence + why (Fix I4)
    const httpEvidence = currentCard.evidence
      .filter((e) => /^https?:\/\//i.test(e.source))
      .slice(0, 2);

    for (const ev of httpEvidence) {
      try {
        const toolCtx = { scanId: ctx.scanId, mode: ctx.mode, budget: ctx.budget };
        const linkResult = await checkLink.run({ url: ev.source, claim: currentCard.why }, toolCtx);
        if (!linkResult.entails) {
          if (!failedRules.includes("entailment")) {
            failedRules.push("entailment");
          }
        }
      } catch {
        // Network/budget errors are treated as pass (fail-open for link checks)
      }
    }
  }

  return {
    pass: failedRules.length === 0,
    failedRules,
    card: currentCard,
  };
}

// ---------------------------------------------------------------------------
// Fixable rules — rules where the LLM revised card can help
// ---------------------------------------------------------------------------
const FIXABLE_RULES = new Set(["specificity", "draft_cites_fact", "audience_honest"]);

// ---------------------------------------------------------------------------
// Downgrade-only rules — after exhaustion, downgrade to probability_based + cap 0.6
// ---------------------------------------------------------------------------
const DOWNGRADE_ELIGIBLE_RULES = new Set(["evidence", "confidence_cap"]);

// ---------------------------------------------------------------------------
// criticGateCard — reject/revise loop for a single card
// ---------------------------------------------------------------------------
export async function criticGateCard(
  ctx: ScanContext,
  card: ActionCard,
  maxRetries = 3,
): Promise<{ outcome: "pass" | "drop" | "downgrade"; card: ActionCard; failedRules: string[] }> {
  let current = card;
  let lastFailedRules: string[] = [];

  // Fix I2: exactly maxRetries (3) runCritic passes max
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await runCritic(ctx, current);
    if (result.pass) {
      return { outcome: "pass", card: result.card, failedRules: [] };
    }

    lastFailedRules = result.failedRules;
    // Use the (possibly LLM-revised) card for the next attempt
    current = result.card;

    // Fix I3: break early when there's a hard failure that is neither fixable
    // nor downgrade-eligible — revision can't help and downgrade won't apply
    const hasHardFail = result.failedRules.some(
      (r) => !FIXABLE_RULES.has(r) && !DOWNGRADE_ELIGIBLE_RULES.has(r),
    );
    if (hasHardFail) break; // can't fix via revision and can't downgrade → will be dropped
  }

  // Exhausted retries (or early break) — decide: downgrade or drop

  // Fix C1: downgrade ONLY when EVERY remaining failed rule is in DOWNGRADE_ELIGIBLE_RULES
  // (evidence / confidence_cap). Any other failure — including fixable rules that weren't
  // resolved — causes a drop.
  const onlyDowngradeable =
    lastFailedRules.length > 0 &&
    lastFailedRules.every((r) => DOWNGRADE_ELIGIBLE_RULES.has(r));

  if (onlyDowngradeable) {
    // §9.1 fallback: relabel basis + cap confidence — NO fabricated evidence (Fix I1)
    const downgraded: ActionCard = {
      ...current,
      basis: "probability_based",
      confidence: Math.min(current.confidence, 0.6),
    };
    return { outcome: "downgrade", card: downgraded, failedRules: lastFailedRules };
  }

  // Drop: hard failures or mixed fixable+downgrade-eligible that couldn't be resolved
  return { outcome: "drop", card: current, failedRules: lastFailedRules };
}

// ---------------------------------------------------------------------------
// Source diversity rule (6) — no single sourceType backs > 30% of passing cards
// Only applies when there are enough cards to make the rule meaningful (≥4)
// ---------------------------------------------------------------------------
function enforceSourceDiversity(cards: ActionCard[]): ActionCard[] {
  if (cards.length < 4) return cards; // not enough cards to enforce diversity

  const threshold = 0.3;
  const maxAllowed = Math.max(1, Math.floor(cards.length * threshold));

  // Count dominant sourceType per card (the most frequent sourceType in its evidence)
  function dominantSourceType(card: ActionCard): string {
    const counts = new Map<string, number>();
    for (const ev of card.evidence) {
      counts.set(ev.sourceType, (counts.get(ev.sourceType) ?? 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [st, count] of counts) {
      if (count > bestCount) { bestCount = count; best = st; }
    }
    return best;
  }

  // Group by dominant sourceType
  const byType = new Map<string, ActionCard[]>();
  for (const card of cards) {
    const st = dominantSourceType(card);
    const existing = byType.get(st) ?? [];
    existing.push(card);
    byType.set(st, existing);
  }

  // For each over-represented type, drop the lowest-confidence excess
  const toKeep = new Set(cards);
  for (const [, group] of byType) {
    if (group.length > maxAllowed) {
      // Sort by confidence ascending — drop the weakest ones
      const sorted = [...group].sort((a, b) => a.confidence - b.confidence);
      const excess = sorted.slice(0, group.length - maxAllowed);
      for (const card of excess) {
        toKeep.delete(card);
      }
    }
  }

  return cards.filter((c) => toKeep.has(c));
}

// ---------------------------------------------------------------------------
// runCriticGate — plan-level entry point
// ---------------------------------------------------------------------------
export async function runCriticGate(
  ctx: ScanContext,
  actions: ActionCard[],
): Promise<{
  passed: ActionCard[];
  rejected: Array<{ title: string; failedRules: string[] }>;
}> {
  const started = Date.now();
  const passed: ActionCard[] = [];
  const rejected: Array<{ title: string; failedRules: string[] }> = [];
  let totalRejections = 0;

  for (const card of actions) {
    const { outcome, card: finalCard, failedRules } = await criticGateCard(ctx, card);

    if (outcome === "drop") {
      totalRejections++;
      rejected.push({ title: card.title, failedRules });
    } else {
      // "pass" or "downgrade" — include in passing set
      passed.push(finalCard);
      if (outcome === "downgrade") {
        totalRejections++; // downgraded cards still count as a critic rejection event
      }
    }
  }

  // Apply source diversity rule (6) — drop excess from over-represented sourceType
  const diversePassed = enforceSourceDiversity(passed);
  const diverseDropped = passed.filter((c) => !diversePassed.includes(c));
  for (const card of diverseDropped) {
    totalRejections++;
    rejected.push({ title: card.title, failedRules: ["source_diversity"] });
  }

  await recordPipelineRun({
    scanId: ctx.scanId,
    stage: "critic",
    costCents: 0,
    criticRejections: totalRejections,
    durationMs: Date.now() - started,
  });

  return { passed: diversePassed, rejected };
}
