// tests/publish/machine/types.test.ts — BUILD §9's type leaf.
//
// Shape assertions, and they are the whole point: every pin below is a
// distinction that renders as nothing at runtime and is deleted by somebody
// tidying. The `@ts-expect-error` fixtures are the mutation test — deleting
// the member each one protects makes the fixture compile, which fails the
// suite at `npm run typecheck` before any test runs.
//
// The archived plan is WO-206.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  DeliveryResult,
  DestinationAdapter,
  State,
  UnpublishResult,
  VerifyOutcome,
} from "@/lib/publish/types";

const LEAF = path.resolve(
  import.meta.dirname,
  "../../../src/lib/publish/types.ts"
);

describe("§9's state machine has exactly ten states", () => {
  it("an exhaustive switch over State with no default arm compiles", () => {
    // Deleting a member of `State` — or adding an eleventh — stops this
    // compiling, which is the assertion. The runtime half only proves the
    // function is total over the ten it was written for.
    const name = (s: State): string => {
      switch (s) {
        case "planned":
          return "planned";
        case "generating":
          return "generating";
        case "in_review":
          return "in_review";
        case "approved":
          return "approved";
        case "publishing":
          return "publishing";
        case "published":
          return "published";
        case "skipped":
          return "skipped";
        case "failed":
          return "failed";
        case "needs_attention":
          return "needs_attention";
        case "unpublished":
          return "unpublished";
      }
    };
    expect(name("planned")).toBe("planned");
    expect(name("unpublished")).toBe("unpublished");
  });

  it("an eleventh state is a type error", () => {
    // @ts-expect-error there is no eleventh state
    const eleventh: State = "paused";
    expect(eleventh).toBe("paused");
  });
});

describe("ADR-084 Decision 2 — servesPublicly and hostedByUs are two members", () => {
  const methods = {
    async deliver() {
      return { ok: true, madeLive: true } satisfies DeliveryResult;
    },
    async unpublish() {
      return { ok: true, outcome: "removed" } as const;
    },
    async health() {
      return { health: "ok" as const, reason: null };
    },
  };

  it("an adapter carrying both type-checks", () => {
    const adapter: DestinationAdapter = {
      kind: "hosted",
      servesPublicly: true,
      hostedByUs: true,
      ...methods,
    };
    expect(adapter.servesPublicly && adapter.hostedByUs).toBe(true);
  });

  it("an adapter missing servesPublicly does not type-check", () => {
    // @ts-expect-error servesPublicly is required — merging the two booleans back into one makes this compile
    const adapter: DestinationAdapter = { kind: "hosted", hostedByUs: true, ...methods };
    expect(adapter.hostedByUs).toBe(true);
  });

  it("an adapter missing hostedByUs does not type-check", () => {
    // @ts-expect-error hostedByUs is required — the two agreed until 2026-09-01 and differ at WordPress
    const adapter: DestinationAdapter = { kind: "hosted", servesPublicly: true, ...methods };
    expect(adapter.servesPublicly).toBe(true);
  });
});

describe("ADR-084 Decision 4 — madeLive is a stated fact, not an optional one", () => {
  it("a DeliveryResult without madeLive is a type error", () => {
    // @ts-expect-error madeLive is required: an omitted one reads as "never made live"
    const result: DeliveryResult = { ok: true, liveUrl: "https://content.example.com/a" };
    expect(result.ok).toBe(true);
  });

  it("madeLive and liveUrl are independent — a true one with no address type-checks", () => {
    const result: DeliveryResult = { ok: true, madeLive: true };
    expect(result.liveUrl).toBeUndefined();
  });
});

describe("ADR-084 Decision 4 — UnpublishResult has five ok-arms and one failure arm", () => {
  it("an exhaustive switch over the five with no default arm compiles", () => {
    const line = (r: UnpublishResult): string => {
      if (!r.ok) return `failed:${r.reason}`;
      switch (r.outcome) {
        case "removed":
          return "removed";
        case "returned_to_draft":
          return "returned_to_draft";
        case "named_for_removal":
          return "named_for_removal";
        case "already_gone":
          return "already_gone";
        case "unreachable":
          return "unreachable";
      }
    };
    expect(line({ ok: true, outcome: "named_for_removal" })).toBe("named_for_removal");
    expect(line({ ok: true, outcome: "unreachable", retryOffered: true })).toBe("unreachable");
    expect(line({ ok: false, reason: "network" })).toBe("failed:network");
  });

  it("a sixth outcome is a type error", () => {
    // @ts-expect-error the union is closed at five ok-arms
    const sixth: UnpublishResult = { ok: true, outcome: "deleted" };
    expect(sixth.ok).toBe(true);
  });
});

describe("ADR-085 — page_not_found and could_not_confirm cannot carry each other's payload", () => {
  it("an exhaustive switch over the three arms with no default compiles", () => {
    const at = new Date();
    const arm = (o: VerifyOutcome): string => {
      switch (o.outcome) {
        case "found":
          return "found";
        case "page_not_found":
          return `gone:${o.status}`;
        case "could_not_confirm":
          return `unknown:${o.why}`;
      }
    };
    expect(arm({ outcome: "page_not_found", status: 410, checkedAt: at })).toBe("gone:410");
    expect(arm({ outcome: "could_not_confirm", why: "server_error", checkedAt: at })).toBe(
      "unknown:server_error"
    );
  });

  it("a could_not_confirm outcome has no status", () => {
    // @ts-expect-error widening either arm to accept the other's payload is the first step of every merge of the two
    const merged: VerifyOutcome = { outcome: "could_not_confirm", status: 404, checkedAt: new Date() };
    expect(merged.outcome).toBe("could_not_confirm");
  });

  it("a page_not_found outcome has no why", () => {
    // @ts-expect-error the two arms have opposite consequences and must not share a shape
    const merged: VerifyOutcome = { outcome: "page_not_found", why: "unreachable", checkedAt: new Date() };
    expect(merged.outcome).toBe("page_not_found");
  });

  it("checkedAt is required on all three arms", () => {
    // @ts-expect-error no surface may state a page's standing without carrying when ReachKit looked
    const noDate: VerifyOutcome = { outcome: "found", checks: {} as never };
    expect(noDate.outcome).toBe("found");
  });
});

describe("the leaf imports nothing from src/lib/publish", () => {
  const source = readFileSync(LEAF, "utf8");
  const specifiers = [...source.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);

  // Two imports since #48. `CopyKey` joins `Measured<T>` because
  // `DestinationView` names the sentences a surface renders and every
  // sentence the product speaks is a key — and because the view belongs in
  // the leaf: `health/` builds one and `index.ts` returns one, so
  // declaring it in either would put a cycle back where ADR-092 took one
  // out. Neither module imports anything from here, so neither adds one.
  it("its imports are Measured<T> and CopyKey, and nothing else", () => {
    expect(specifiers).toEqual(["@/lib/measure/measured", "@/lib/presentation/copy"]);
  });

  it("no specifier resolves inside src/lib/publish — the leaf property, kept by test", () => {
    for (const specifier of specifiers) {
      expect(specifier?.startsWith("@/lib/publish")).toBe(false);
      expect(specifier?.startsWith(".")).toBe(false);
    }
  });
});
