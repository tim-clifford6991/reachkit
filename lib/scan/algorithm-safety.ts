/**
 * Algorithm Safety (§11) — Task 9
 *
 * Enforces four §11 checks on a plan-level action set:
 *
 *   (6) Generic-tell scan       — score + optional Haiku rewrite
 *   (5) Cross-customer divergence — embed + searchSimilar + optional rewrite + insertEmbeddings
 *   (3) Outreach cap            — at most 5 outreach cards (highest confidence)
 *   (4) Cadence caps            — 1 action per distinct evidence source host (outreach/content)
 *
 * §11.1 No-auto — every returned card has draftRequiresEdit forced to true.
 *
 * Fixture mode: deterministic checks run (generic heuristic, caps, dedup), but
 * LLM rewrites and real embeddings are skipped (callEmbed uses fixtureEmbed → ok).
 */

import { callModel } from "@/lib/llm/anthropic";
import { callEmbed } from "@/lib/llm/embed";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import {
  insertEmbeddings,
  deleteEmbeddingsForApp,
  searchSimilar,
} from "@/lib/scan/embeddings";
import type { ActionCard } from "@/lib/llm/types";
import type { ScanContext } from "@/lib/scan/pipeline";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HAIKU_MODEL = "claude-haiku-4-5-20251001" as const;
const OUTREACH_CAP = 5;
const DIVERGENCE_THRESHOLD = 0.92;
const GENERIC_THRESHOLD = 2; // ≥ this many matched phrases → flagged generic

/**
 * Curated list of AI-ism / cliché patterns (case-insensitive).
 * Each entry is either a plain substring or a regex source string.
 */
const GENERIC_PHRASES: ReadonlyArray<string | RegExp> = [
  "in today's fast-paced world",
  "look no further",
  "game-changer",
  "game changer",
  "leverage",
  "unlock",
  "elevate",
  "seamless",
  "dive in",
  "dive into",
  "in conclusion",
  "take your .{1,30} to the next level",
  "revolutionize",
  "supercharge",
  "effortlessly",
  "robust",
  "cutting-edge",
  "cutting edge",
  "state-of-the-art",
  "state of the art",
  "transformative",
  "synergy",
  "paradigm shift",
  "best-in-class",
  "best in class",
  "world-class",
  "world class",
  "innovative solution",
  // Excessive em-dashes: 2 or more in the same sentence/paragraph
  /—[^—\n]{0,120}—[^—\n]{0,120}—/,
];

// ---------------------------------------------------------------------------
// (6) Generic-tell score
// ---------------------------------------------------------------------------

/**
 * Count how many generic phrases/patterns appear in the draft (case-insensitive).
 * A draft scoring ≥ GENERIC_THRESHOLD is considered generic.
 */
export function genericTellScore(draft: string): number {
  const lower = draft.toLowerCase();
  let score = 0;

  for (const phrase of GENERIC_PHRASES) {
    if (typeof phrase === "string") {
      if (lower.includes(phrase.toLowerCase())) {
        score++;
      }
    } else {
      // RegExp — test against the original (regex may be case-sensitive) and lower
      const flags = phrase.flags.includes("i") ? phrase.flags : phrase.flags + "i";
      const re = new RegExp(phrase.source, flags);
      if (re.test(draft)) {
        score++;
      }
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Haiku rewrite helper (shared for generic-tell and divergence)
// ---------------------------------------------------------------------------

async function rewriteDraft(
  ctx: ScanContext,
  draft: string,
  instruction: string,
): Promise<string> {
  const result = await callModel({
    model: HAIKU_MODEL,
    system:
      "You are a marketing copy editor. Rewrite the provided draft according to the instruction. " +
      "Output ONLY the rewritten draft — no preamble, no explanation, no markdown.",
    prompt: `Instruction: ${instruction}\n\nDraft to rewrite:\n${draft}`,
    scanId: ctx.scanId,
    stage: "format",
    maxTokens: 1024,
  });
  return result.text.trim() || draft;
}

// ---------------------------------------------------------------------------
// (6) Generic-tell check — flags and optionally rewrites
// ---------------------------------------------------------------------------

async function applyGenericTellCheck(
  ctx: ScanContext,
  card: ActionCard,
): Promise<ActionCard> {
  const draft = card.draft;
  if (draft === null || draft.trim().length === 0) return card;

  const initialScore = genericTellScore(draft);
  if (initialScore < GENERIC_THRESHOLD) return card;

  // In fixture mode: skip LLM rewrite but still return the card as-is
  // (the flag is implicit — callers see no difference; the card is not dropped)
  if (fixturesEnabled()) {
    return card;
  }

  // Attempt ONE Haiku rewrite
  let rewritten: string;
  try {
    rewritten = await rewriteDraft(
      ctx,
      draft,
      "Rewrite this draft to be specific and non-generic, citing the real facts present in the text. " +
        "Remove all AI clichés (game-changer, leverage, seamless, unlock, effortlessly, etc.). " +
        "Keep the same general message and length.",
    );
  } catch {
    // Rewrite failed — keep original
    return card;
  }

  // Keep whichever version is less generic
  const rewrittenScore = genericTellScore(rewritten);
  const finalDraft = rewrittenScore < initialScore ? rewritten : draft;
  return { ...card, draft: finalDraft };
}

// ---------------------------------------------------------------------------
// (5) Cross-customer divergence check
// ---------------------------------------------------------------------------

async function applyDivergenceCheck(
  ctx: ScanContext,
  cards: ActionCard[],
): Promise<ActionCard[]> {
  const draftsWithCards = cards
    .map((card, idx) => ({ card, idx, draft: card.draft }))
    .filter((item): item is { card: ActionCard; idx: number; draft: string } =>
      item.draft !== null && item.draft.trim().length > 0,
    );

  if (draftsWithCards.length === 0) return cards;

  // Embed all drafts (fixtureEmbed in fixtures mode — always fine)
  const texts = draftsWithCards.map((x) => x.draft);
  let vecs: number[][];
  try {
    vecs = await callEmbed(texts);
  } catch {
    // Embedding failed — skip divergence check
    return cards;
  }

  // Drop THIS app's own prior draft embeddings BEFORE the search loop. Without this,
  // a re-scan/weekly-refresh re-embeds near-identical drafts that are still stored from
  // the previous run, so each draft matches its own prior version above the threshold and
  // the app self-flags as "divergent from another customer". Deleting first guarantees the
  // searchSimilar set contains only OTHER apps' drafts (true cross-customer divergence);
  // the same drafts are re-inserted at the end of this function (delete→insert = no dup,
  // safe for retries).
  if (!fixturesEnabled()) {
    try {
      await deleteEmbeddingsForApp(ctx.appId, "draft");
    } catch {
      // Delete failed — proceed; a stale self-match is preferable to aborting the check.
    }
  }

  // Check each draft against OTHER apps' draft embeddings
  const result = [...cards];

  for (let i = 0; i < draftsWithCards.length; i++) {
    const item = draftsWithCards[i];
    const vec = vecs[i];
    if (item === undefined || vec === undefined) continue;

    let isDivergent = false;

    if (!fixturesEnabled()) {
      // Search for similar drafts from OTHER apps. This app's own drafts were just
      // deleted above, so any match here is genuinely from a different customer.
      try {
        const matches = await searchSimilar(vec, {
          subjectType: "draft",
          k: 3,
        });
        const nearDuplicate = matches.some((m) => m.similarity > DIVERGENCE_THRESHOLD);
        if (nearDuplicate) {
          isDivergent = true;
        }
      } catch {
        // Search failed — treat as no divergence
      }
    }
    // In fixture mode: searchSimilar over empty other-customer set → no matches → no divergence

    if (isDivergent) {
      const card = item.card;
      const draft = item.draft;
      let rewritten: string;
      try {
        rewritten = await rewriteDraft(
          ctx,
          draft,
          "Rewrite this draft to be clearly distinct from similar outreach messages that other apps " +
            "might be sending to the same audience. Use specific facts and a unique angle.",
        );
      } catch {
        rewritten = draft;
      }
      result[item.idx] = { ...card, draft: rewritten };
    }
  }

  // Idempotent populate: re-insert this app's (possibly-rewritten) drafts.
  // In non-fixture mode the pre-loop deleteEmbeddingsForApp already cleared this
  // app's "draft" rows, so we don't delete again here. In fixture mode we skipped
  // that delete (to keep the divergence search a pure fixture no-op), so we delete
  // now to stay idempotent across re-runs (delete then insert = no duplicates).
  try {
    if (fixturesEnabled()) {
      await deleteEmbeddingsForApp(ctx.appId, "draft");
    }

    // Re-collect drafts from result (may include rewritten ones)
    const toInsert = result
      .map((card, idx) => ({ card, idx }))
      .filter((x): x is { card: ActionCard & { draft: string }; idx: number } =>
        x.card.draft !== null && x.card.draft.trim().length > 0,
      );

    if (toInsert.length > 0) {
      // Re-embed (some may have been rewritten above)
      const finalTexts = toInsert.map((x) => x.card.draft);
      let finalVecs: number[][];
      try {
        finalVecs = await callEmbed(finalTexts);
      } catch {
        return result;
      }

      await insertEmbeddings(
        toInsert.map((x, i) => ({
          subjectType: "draft",
          subjectKey: `${ctx.appId}:${ctx.scanId}:draft:${x.idx}`,
          appId: ctx.appId,
          content: x.card.draft,
          embedding: finalVecs[i] ?? [],
          model: fixturesEnabled() ? "fixture" : "voyage-3",
          modelVersion: "1",
        })),
      );
    }
  } catch {
    // Embedding population failure is non-fatal — return what we have
  }

  return result;
}

// ---------------------------------------------------------------------------
// (3) Outreach cap — at most 5 outreach cards (highest confidence)
// ---------------------------------------------------------------------------

function applyOutreachCap(cards: ActionCard[]): ActionCard[] {
  const outreach = cards.filter((c) => c.category === "outreach");
  const rest = cards.filter((c) => c.category !== "outreach");

  if (outreach.length <= OUTREACH_CAP) return cards;

  // Keep the top OUTREACH_CAP by confidence (descending)
  const kept = [...outreach]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, OUTREACH_CAP);

  return [...rest, ...kept];
}

// ---------------------------------------------------------------------------
// (4) Cadence caps — 1 action per distinct evidence source host (outreach/content)
// ---------------------------------------------------------------------------

function extractHost(source: string): string | null {
  try {
    return new URL(source).hostname;
  } catch {
    // Not a URL (e.g. a fact-sheet provenance label like "review_themes") — this is
    // NOT a real outreach/content surface, so it must not participate in the §11
    // per-surface cadence cap. Otherwise unrelated cards that merely cite the same
    // provenance label collapse, silently dropping a whole action category. Treat
    // as "no surface".
    return null;
  }
}

function applyPerSurfaceCap(cards: ActionCard[]): ActionCard[] {
  const capped: ActionCard[] = [];
  const seenHosts = new Set<string>();

  // Sort by confidence descending so we keep the highest-confidence card per host
  const sorted = [...cards].sort((a, b) => b.confidence - a.confidence);

  for (const card of sorted) {
    if (card.category !== "outreach" && card.category !== "content") {
      capped.push(card);
      continue;
    }

    // Collect all distinct REAL surface hosts (URL hostnames) from this card's
    // evidence. Non-URL provenance labels return null and are excluded — they are
    // not surfaces and must not trigger the cadence cap.
    const cardHosts = Array.from(
      new Set(
        card.evidence
          .map((ev) => extractHost(ev.source))
          .filter((h): h is string => h !== null),
      ),
    );

    // A card is allowed through only if NONE of its source hosts is already seen
    const hasConflict = cardHosts.some((h) => seenHosts.has(h));

    if (!hasConflict) {
      capped.push(card);
      for (const h of cardHosts) {
        seenHosts.add(h);
      }
    }
    // else: drop (same surface already covered by a higher-confidence card)
  }

  return capped;
}

// ---------------------------------------------------------------------------
// §11.1 No-auto — force draftRequiresEdit on every card
// ---------------------------------------------------------------------------

function forceNoAuto(cards: ActionCard[]): ActionCard[] {
  return cards.map((c) => ({ ...c, draftRequiresEdit: true as const }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all §11 algorithm-safety checks on the plan-level action set.
 * Returns the safe, filtered, annotated action set.
 */
export async function algorithmSafety(
  ctx: ScanContext,
  actions: ActionCard[],
): Promise<ActionCard[]> {
  // (6) Generic-tell: check each card independently
  let safe = await Promise.all(
    actions.map((card) => applyGenericTellCheck(ctx, card)),
  );

  // (5) Cross-customer divergence: embed + search + idempotent store
  safe = await applyDivergenceCheck(ctx, safe);

  // (3) Outreach cap
  safe = applyOutreachCap(safe);

  // (4) Cadence caps / per-surface dedup
  safe = applyPerSurfaceCap(safe);

  // §11.1 No-auto: assert draftRequiresEdit on every surviving card
  safe = forceNoAuto(safe);

  return safe;
}
