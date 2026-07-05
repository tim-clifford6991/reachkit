/**
 * PlanBoardView — the "Queue" tab: the full central plan from the `actions`
 * table, grouped by verify lifecycle (lib/scan/action-board.ts). Three
 * sections — Open (biggest predicted Δ first, Mark-done affordance), Verifying
 * (in-flight re-checks), Verified (measured Δ, newest first) — under a compact
 * summary strip. Failed verifies (the board's `retry` group) rejoin the Open
 * queue with a "Retry" pill: verify.ts leaves their status open, so they are
 * genuinely still work to do.
 *
 * SERVER component (no "use client") — presentational, all data arrives as a
 * prop from the page. Only imports non-function exports (`Card`, `Eyebrow`)
 * from the "use client" kit, per the intel RSC rule; the interactive Mark-done
 * lives inside the client `PlanItem`.
 */
import Link from "next/link";
import { Card, Eyebrow } from "@/components/app/intel/kit";
import { PlanItem, type PlanItemData } from "@/components/app/intel/plan-item";
import { byPredictedDeltaDesc, type ActionBoard, type BoardAction } from "@/lib/scan/action-board";

const JM = "var(--font-mono)";

// Status-pill colors — match PlanItem's language (pill bg, white text).
const VERIFYING_COLOR = "#C98A12";
const VERIFIED_COLOR = "#1F9D5B";
const RETRY_COLOR = "#E5484D";

/** "+6 pts" / "-2 pts" from a score delta (1 decimal only when fractional). */
function fmtPts(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${n > 0 ? "+" : ""}${v} pts`;
}

function toItem(a: BoardAction, extra: Partial<PlanItemData> = {}): PlanItemData {
  return {
    id: a.id,
    title: a.title,
    type: a.category,
    why: a.why,
    predictedPts: a.predictedDelta !== null ? fmtPts(a.predictedDelta) : null,
    // Execution payload from the plan views — the queue is workable in place:
    // the draft is one disclosure away, the venue link opens the target, and
    // Mark-done arrives prefilled with the verify URL.
    draft: a.draft,
    verifyUrl: a.verifyUrl,
    effortMin: a.effortMin,
    ...extra,
  };
}

export function PlanBoardView({ board }: { board: ActionBoard }) {
  // Retry items are open work in practice — they rejoin the queue (with a
  // "Retry" pill) and re-sort with it by predicted delta.
  const retryIds = new Set(board.retry.map((a) => a.id));
  const openQueue: PlanItemData[] = [...board.open, ...board.retry]
    .sort(byPredictedDeltaDesc)
    .map((a) => toItem(a, retryIds.has(a.id) ? { status: "Retry", statusColor: RETRY_COLOR } : {}));
  if (openQueue[0]) openQueue[0] = { ...openQueue[0], doFirst: true };

  const verifying: PlanItemData[] = board.verifying.map((a) =>
    toItem(a, { status: "Verifying", statusColor: VERIFYING_COLOR }),
  );
  const verified: PlanItemData[] = board.done.map((a) =>
    toItem(a, {
      status: "Verified",
      statusColor: VERIFIED_COLOR,
      actualPts: a.actualDelta !== null ? fmtPts(a.actualDelta) : null,
    }),
  );

  const total = openQueue.length + verifying.length + verified.length;
  if (total === 0) return <EmptyBoard />;

  // Total measured points across verified fixes — only when at least one fix
  // has a genuine snapshot-measured delta.
  const measured = board.done.filter((a) => a.actualDelta !== null);
  const verifiedPts = measured.length > 0 ? measured.reduce((s, a) => s + (a.actualDelta ?? 0), 0) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SummaryStrip open={openQueue.length} verifying={verifying.length} verified={verified.length} verifiedPts={verifiedPts} />

      {openQueue.length > 0 && (
        <Card title="Open" meta={`${openQueue.length} queued`} info="Fixes you've queued but not shipped yet, biggest predicted score move first. Mark one done when it's live and we'll re-check the page.">
          <ItemStack items={openQueue} showMarkDone />
        </Card>
      )}

      {verifying.length > 0 && (
        <Card title="Verifying" meta={`${verifying.length} in flight`}>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 12px" }}>
            Re-checking your live page — a fix only counts when it&rsquo;s confirmed.
          </p>
          <ItemStack items={verifying} />
        </Card>
      )}

      {verified.length > 0 && (
        <Card title="Verified" meta={`${verified.length} confirmed`} info="Fixes confirmed live, newest first — each with the score movement actually measured at verification.">
          <ItemStack items={verified} />
        </Card>
      )}

      <div style={{ textAlign: "right" }}>
        <Link href="/app/progress" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          Verified fixes appear on your Progress timeline &rarr;
        </Link>
      </div>
    </div>
  );
}

function ItemStack({ items, showMarkDone = false }: { items: PlanItemData[]; showMarkDone?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => (
        <PlanItem key={item.id} item={item} showMarkDone={showMarkDone} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary strip — compact counts across the three lifecycle stages, plus the
// total measured points once any fix has verified.
// ---------------------------------------------------------------------------
function SummaryStrip({ open, verifying, verified, verifiedPts }: { open: number; verifying: number; verified: number; verifiedPts: number | null }) {
  return (
    <Card style={{ padding: "16px 22px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 32 }}>
        <StripStat label="Open" value={open} />
        <StripStat label="Verifying" value={verifying} color={verifying > 0 ? VERIFYING_COLOR : undefined} />
        <StripStat label="Verified" value={verified} color={verified > 0 ? VERIFIED_COLOR : undefined} />
        {verifiedPts !== null && (
          <span style={{ marginLeft: "auto", fontFamily: JM, fontSize: 13, fontWeight: 700, color: verifiedPts >= 0 ? VERIFIED_COLOR : RETRY_COLOR }}>
            {fmtPts(verifiedPts)} verified
          </span>
        )}
      </div>
    </Card>
  );
}

function StripStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontFamily: JM, fontSize: 22, fontWeight: 700, lineHeight: 1, color: color ?? "var(--c-ink)" }}>{value}</span>
      <Eyebrow>{label}</Eyebrow>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty board — the plan starts from the gap analyses; point there.
// ---------------------------------------------------------------------------
function EmptyBoard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "56px 20px",
        textAlign: "center",
        border: "1px dashed var(--c-line)",
        borderRadius: "var(--radius-xl)",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>
        Your plan starts from your gaps
      </div>
      <p style={{ fontSize: 13, color: "var(--c-muted)", margin: 0, maxWidth: 460 }}>
        Nothing queued yet. Add fixes from your plans — they line up here, and every verified win lands on your score.
      </p>
      <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
        <Link href="/app/plan" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          Content plan &rarr;
        </Link>
        <Link href="/app/plan" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          Distribution plan &rarr;
        </Link>
      </div>
    </div>
  );
}
