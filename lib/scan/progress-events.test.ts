import { describe, expect, it } from "vitest";
import { buildProgressEvents } from "@/lib/scan/progress-events";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";

/** Minimal MarketSnapshotSummary-shaped fixture (the type is not exported from lib/scan/market). */
function summary(overrides: Partial<{ selfSharePct: number | null; rivals: { domain: string }[] }> = {}) {
  return {
    self: { domain: "acme.com", organicKeywords: null, etv: null, referringDomains: null },
    rivals: overrides.rivals ?? [],
    selfSharePct: overrides.selfSharePct ?? null,
    demandPocketCount: 0,
    keywordGapCount: 0,
  };
}

describe("buildProgressEvents", () => {
  it("returns [] for empty history and no markers", () => {
    expect(buildProgressEvents({ history: [], markers: [], marketSnapshots: [] })).toEqual([]);
  });

  it("turns a marker into an event with the correct delta and plan href", () => {
    const history: ScoreHistoryPoint[] = [
      { takenAt: "2026-07-01T00:00:00Z", total: 40 },
      { takenAt: "2026-07-08T00:00:00Z", total: 55 },
    ];
    const markers: HistoryMarker[] = [
      { takenAt: "2026-07-08T00:00:00Z", label: "Added meta description", category: "seo" },
    ];

    const events = buildProgressEvents({ history, markers, marketSnapshots: [] });

    expect(events).toEqual([
      { label: "Added meta description", date: "2026-07-08T00:00:00Z", delta: 15, href: "/app/plan" },
    ]);
  });

  it("omits delta when the marker lands on the first history point (idx <= 0)", () => {
    const history: ScoreHistoryPoint[] = [{ takenAt: "2026-07-01T00:00:00Z", total: 40 }];
    const markers: HistoryMarker[] = [{ takenAt: "2026-07-01T00:00:00Z", label: "Baseline fix" }];

    const events = buildProgressEvents({ history, markers, marketSnapshots: [] });

    expect(events).toEqual([{ label: "Baseline fix", date: "2026-07-01T00:00:00Z", href: "/app/plan" }]);
  });

  it("omits delta when the marker's takenAt has no matching history point", () => {
    const history: ScoreHistoryPoint[] = [{ takenAt: "2026-07-01T00:00:00Z", total: 40 }];
    const markers: HistoryMarker[] = [{ takenAt: "2026-06-01T00:00:00Z", label: "Orphan marker" }];

    const events = buildProgressEvents({ history, markers, marketSnapshots: [] });

    expect(events).toEqual([{ label: "Orphan marker", date: "2026-06-01T00:00:00Z", href: "/app/plan" }]);
  });

  it("appends market alerts only when exactly two snapshots are present, sorted newest-first", () => {
    const prior = summary({ rivals: [{ domain: "rival-a.com" }] });
    const latest = summary({ rivals: [{ domain: "rival-a.com" }, { domain: "rival-b.com" }] });

    const events = buildProgressEvents({
      history: [],
      markers: [],
      marketSnapshots: [
        { taken_at: "2026-07-08T00:00:00Z", summary: latest },
        { taken_at: "2026-07-01T00:00:00Z", summary: prior },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      label: "New competitor in your space: rival-b.com",
      date: "2026-07-08T00:00:00Z",
    });
  });

  it("produces no alerts with only one snapshot", () => {
    const events = buildProgressEvents({
      history: [],
      markers: [],
      marketSnapshots: [{ taken_at: "2026-07-08T00:00:00Z", summary: summary() }],
    });
    expect(events).toEqual([]);
  });

  it("produces no alerts with more than two snapshots", () => {
    const s = summary();
    const events = buildProgressEvents({
      history: [],
      markers: [],
      marketSnapshots: [
        { taken_at: "2026-07-15T00:00:00Z", summary: s },
        { taken_at: "2026-07-08T00:00:00Z", summary: s },
        { taken_at: "2026-07-01T00:00:00Z", summary: s },
      ],
    });
    expect(events).toEqual([]);
  });

  it("does not throw on empty/minimal summaries", () => {
    expect(() =>
      buildProgressEvents({
        history: [],
        markers: [],
        marketSnapshots: [
          { taken_at: "2026-07-08T00:00:00Z", summary: summary() },
          { taken_at: "2026-07-01T00:00:00Z", summary: summary() },
        ],
      }),
    ).not.toThrow();
  });

  it("sorts marker events and market alerts together, newest first", () => {
    const history: ScoreHistoryPoint[] = [
      { takenAt: "2026-07-01T00:00:00Z", total: 30 },
      { takenAt: "2026-07-08T00:00:00Z", total: 45 },
      { takenAt: "2026-07-22T00:00:00Z", total: 60 },
    ];
    const markers: HistoryMarker[] = [
      { takenAt: "2026-07-08T00:00:00Z", label: "Mid fix" },
      { takenAt: "2026-07-22T00:00:00Z", label: "Latest fix" },
    ];
    const prior = summary({ rivals: [] });
    const latest = summary({ rivals: [{ domain: "rival-c.com" }] });

    const events = buildProgressEvents({
      history,
      markers,
      marketSnapshots: [
        { taken_at: "2026-07-15T00:00:00Z", summary: latest },
        { taken_at: "2026-07-08T00:00:00Z", summary: prior },
      ],
    });

    expect(events.map((e) => e.date)).toEqual([
      "2026-07-22T00:00:00Z",
      "2026-07-15T00:00:00Z",
      "2026-07-08T00:00:00Z",
    ]);
  });
});
