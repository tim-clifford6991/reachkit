// tests/presentation/copy/registry.test.ts
//
// WO-041 test plan. REQ-093 criteria 1 and 5, quoted verbatim in the work
// order's own `## Test plan` table, plus the additional tests WO-041 owns
// (partition closure/totality, COPY_META totality, owner-owed agreement,
// the thirteen band words).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COPY, COPY_META, copy, type CopyKey, type CopyPartition } from "../../../src/lib/presentation/copy/index.ts";
// OWNER_OWED is WO-041's own addition to the interface, not the blueprint's
// (WO-041 `## Interfaces` "Exposes additionally") — it is declared in
// registry.ts, not re-exported through the public barrel, so it is
// imported from its declaring file here.
import { OWNER_OWED, AWAITING_COPY, TODO_COPY_MARKER } from "../../../src/lib/presentation/copy/registry.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COPY_DIR = path.resolve(HERE, "../../../src/lib/presentation/copy");
const KEYS_DIR = path.join(COPY_DIR, "keys");

/** The partition files, by name, in sorted order. */
const KEY_FILES: readonly string[] = fs.readdirSync(KEYS_DIR).filter((f) => f.endsWith(".ts")).sort();

/** Each partition's exported const, read on its own — the closure and
 *  "traces to exactly one partition" checks below need each partition
 *  before the spread in registry.ts merges them. */
async function loadPartitions(): Promise<Map<string, CopyPartition>> {
  const out = new Map<string, CopyPartition>();
  for (const file of KEY_FILES) {
    const mod: Record<string, CopyPartition> = await import(
      /* @vite-ignore */ `../../../src/lib/presentation/copy/keys/${file}`
    );
    const [exported] = Object.values(mod);
    if (!exported) throw new Error(`${file} exports nothing`);
    out.set(file, exported);
  }
  return out;
}

const KEY_SOURCES = new Map(KEY_FILES.map((f) => [f, fs.readFileSync(path.join(KEYS_DIR, f), "utf8")]));
const REGISTRY_SOURCE = fs.readFileSync(path.join(COPY_DIR, "registry.ts"), "utf8");

describe("REQ-093 c1 — COPY is the only source of a product sentence", () => {
  it("COPY is frozen: writing an existing key throws, adding a new key throws", () => {
    expect(() => {
      (COPY as Record<string, string>)["band.score.dominant"] = "changed";
    }).toThrow(TypeError);
    expect(() => {
      (COPY as Record<string, string>)["a-key-nobody-declared"] = "new";
    }).toThrow(TypeError);
    // The attempted write never took: frozen means frozen, not "throws but
    // still mutates" in a non-strict host.
    expect(COPY["band.score.dominant"]).toBe("Dominant");
  });

  it("every value in COPY traces to a string literal present in one partition source read from disk", () => {
    for (const [key, value] of Object.entries(COPY)) {
      const literal = JSON.stringify(value);
      const foundIn = [...KEY_SOURCES.entries()].filter(([, src]) => src.includes(literal));
      expect(foundIn.length, `COPY["${key}"] = ${literal} was not found verbatim in any keys/*.ts source`).toBeGreaterThan(0);
    }
  });

  it("the module's transitive import graph contains no path under src/lib/llm/", () => {
    const entry = path.join(COPY_DIR, "index.ts");
    const visited = new Set<string>();
    const externalSpecifiers: string[] = [];
    const queue = [entry];

    while (queue.length > 0) {
      const file = queue.shift();
      if (!file || visited.has(file)) continue;
      visited.add(file);
      const src = fs.readFileSync(file, "utf8");
      const re = /\bfrom\s+["']([^"']+)["']/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(src))) {
        const specifier = match[1];
        if (!specifier) continue;
        if (specifier.startsWith(".")) {
          const resolved = path.resolve(path.dirname(file), specifier);
          queue.push(resolved);
        } else {
          externalSpecifiers.push(specifier);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(0);
    for (const specifier of externalSpecifiers) {
      expect(specifier).not.toMatch(/lib\/llm/);
    }
    // Today this module has no external (non-relative) import at all —
    // the strongest form of "reaches for nothing" — but the assertion
    // above is the one that discriminates if that ever changes.
  });
});

describe("REQ-093 c5 — the registry renders with every model unavailable", () => {
  // TST-018 defect 2: this test previously mocked `@/lib/llm` and asserted
  // against the mock. `src/lib/llm/` does not exist in this repo yet and
  // nothing in this module's import graph reaches for it (the c1
  // zero-import-graph test above establishes that structurally), so the
  // mock never fired — deleting the whole mock block left the test's
  // outcome unchanged, i.e. it was dead code. What actually discriminates
  // c5 is that every non-owner-owed key renders its stored literal through
  // `copy()` with no lazy fetch, catalogue load or model call on the read
  // path — the same property the c1 import-graph test proves has nothing
  // to reach for. That assertion, plus the count (rule 5.5), is kept below
  // without the vacuous mocking apparatus.
  it("every non-owner-owed key returns its literal through copy(), with zero import path to a language model", () => {
    const nonOwnerOwed = (Object.keys(COPY) as CopyKey[]).filter((key) => !OWNER_OWED.includes(key));
    const awaiting = new Set<CopyKey>(AWAITING_COPY);
    const ruled = nonOwnerOwed.filter((key) => !awaiting.has(key));

    // Only the ruled sentences carry their slots' `{name}` placeholders —
    // a `TODO(copy)` marker is one literal with no placeholder in it, so
    // substituting into it proves nothing about `copy()`.
    for (const key of ruled) {
      const slotNames = Object.keys(COPY_META[key].slots);
      if (slotNames.length === 0) {
        expect(copy(key)).toBe(COPY[key]);
        continue;
      }
      // A slotted key's stored literal still carries its `{slotName}`
      // placeholder(s) — that is what COPY holds — so the discriminating
      // assertion here is that copy() substitutes rather than reaches for
      // anything external, not literal equality against COPY[key].
      const vars = Object.fromEntries(slotNames.map((name) => [name, `<${name}>`]));
      const rendered = copy(key, vars);
      for (const name of slotNames) {
        expect(rendered).not.toContain(`{${name}}`);
        expect(rendered).toContain(`<${name}>`);
      }
    }
  });
});

describe("the partition list is closed and total (BP-020 decision 5)", () => {
  it("keys/ holds exactly fifteen partition files", () => {
    expect(KEY_FILES).toEqual([
      "bands.ts",
      "calendar.ts",
      "chrome.ts",
      "danger.ts",
      "draft.ts",
      "laws.ts",
      "mail.ts",
      "meta.ts",
      "offer.ts",
      "overview.ts",
      "publish.ts",
      "report.ts",
      "settings.ts",
      "setup.ts",
      "signin.ts",
    ]);
  });

  it("registry.ts imports every file under keys/, and no sixteenth", () => {
    const importedKeyFiles = [...REGISTRY_SOURCE.matchAll(/from\s+["']\.\/keys\/([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((f): f is string => f !== undefined);
    expect(new Set(importedKeyFiles)).toEqual(new Set(KEY_FILES));
    expect(importedKeyFiles).toHaveLength(15);
  });

  it("every key in COPY traces to exactly one partition", async () => {
    const partitions = await loadPartitions();
    const seen = new Map<string, string>();
    for (const [file, partition] of partitions) {
      for (const key of Object.keys(partition)) {
        const owner = seen.get(key);
        expect(owner, `"${key}" is declared in both ${owner} and ${file}`).toBeUndefined();
        seen.set(key, file);
      }
    }
    expect(new Set(seen.keys())).toEqual(new Set(Object.keys(COPY)));
  });

  it("no partition file imports another partition or any surface", () => {
    for (const [file, src] of KEY_SOURCES) {
      const specifiers = [...src.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
        .map((m) => m[1])
        .filter((s): s is string => s !== undefined);
      for (const specifier of specifiers) {
        expect(specifier.startsWith("./"), `${file} imports a sibling partition or surface: "${specifier}"`).toBe(
          false
        );
        expect(specifier).toBe("../registry.ts");
      }
    }
  });
});

describe("COPY_META is total over CopyKey", () => {
  it("a partition entry without CopyMeta is a compile error", () => {
    // @ts-expect-error — a CopyPartition entry must be a [string, CopyMeta]
    // pair; a bare string is not assignable, so a key without meta cannot
    // exist. Discharged by `npm run typecheck`, not by Vitest (see
    // tests/ui/surface.test.tsx for the same convention).
    const bad: CopyPartition = { "fixture.bad": "a bare string, not a [string, CopyMeta] pair" };
    expect(bad).toBeTruthy();
  });
});

describe("owner-owed and empty agree both ways", () => {
  it("every OWNER_OWED key has COPY[key] === '', and every '' value is in OWNER_OWED", () => {
    for (const key of OWNER_OWED) {
      expect(COPY[key]).toBe("");
    }
    const emptyKeys = (Object.keys(COPY) as CopyKey[]).filter((key) => COPY[key] === "");
    expect(new Set(emptyKeys)).toEqual(new Set(OWNER_OWED));
  });

  it("every key still unwritten is accounted for, both ways (rule 5.5)", () => {
    // Issue #545: the per-partition ledger `counts.snapshot.json` is gone. It
    // recorded counts nothing but CI read and made every key-adding PR
    // regenerate it; what it guaranteed is asserted from the registry itself.
    const awaiting = (Object.keys(COPY) as CopyKey[]).filter((key) => COPY[key] === TODO_COPY_MARKER);
    expect(new Set(AWAITING_COPY)).toEqual(new Set(awaiting));

    // The two representations never overlap: an empty value and the marker
    // are different values, so no key can be on both lists.
    for (const key of AWAITING_COPY) {
      expect(OWNER_OWED).not.toContain(key);
      expect(COPY[key]).toBe(TODO_COPY_MARKER);
    }
  });
});

describe("the thirteen band words are the ruled words", () => {
  it("winnability — BP-019 decision 6 (owner ruling, 2026-08-31)", () => {
    expect(copy("band.winnability.winnable")).toBe("Winnable");
    expect(copy("band.winnability.reach")).toBe("Reach");
    expect(copy("band.winnability.notYet")).toBe("Not yet");
    // The transcription note BP-019 decision 6 deliberately did not
    // smooth: "Not yet" renders, never "Not-yet" (the internal handle).
    expect(copy("band.winnability.notYet")).not.toBe("Not-yet");
  });

  it("rival size — BP-019 decision 6 (owner ruling, 2026-08-31)", () => {
    expect(copy("band.rivalSize.near")).toBe("Similar size");
    expect(copy("band.rivalSize.middle")).toBe("Larger");
    expect(copy("band.rivalSize.far")).toBe("Much larger");
  });

  it("severity — BP-019 decision 6 (owner ruling, 2026-08-31), REQ-009 c8", () => {
    expect(copy("severity.low")).toBe("Minor");
    expect(copy("severity.mid")).toBe("Worth fixing");
    expect(copy("severity.high")).toBe("Critical");
  });

  it("score bands — REQ-004 criterion 1's own words: \"Invisible, Hard to find, Findable, Dominant\"", () => {
    expect(copy("band.score.invisible")).toBe("Invisible");
    expect(copy("band.score.hard-to-find")).toBe("Hard to find");
    expect(copy("band.score.findable")).toBe("Findable");
    expect(copy("band.score.dominant")).toBe("Dominant");
  });
});

describe("the thirteen keys the owner ruled 2026-09-04 (WO-041 `## Log`, this date's ruling)", () => {
  it("price and offer — unslotted", () => {
    expect(copy("price.amount")).toBe("€49");
    expect(copy("price.interval")).toBe("per month, VAT included");
    expect(copy("offer.start")).toBe("Start ReachKit");
  });

  it("price and offer — slotted, {value}", () => {
    expect(copy("offer.cadence.page", { value: "every week" })).toBe(
      "One new page written for your site every week"
    );
    expect(copy("offer.cadence.measure", { value: "every week" })).toBe(
      "Your findability re-measured every week"
    );
    expect(copy("offer.cadence.movement", { value: "every week" })).toBe(
      "What moved, in your inbox every week"
    );
    expect(copy("offer.veto.window", { value: "24 hours" })).toBe(
      "Every page waits 24 hours for you to stop it before it goes live — and you can cancel any time, yourself"
    );
  });

  it("report — no-presence-yet line for the first page of the rival list", () => {
    expect(copy("place.report.first-page.rival")).toBe("No rival holds this ground yet");
  });

  it("stopped-work law — two of the five lines", () => {
    expect(copy("stopped.work.line")).toBe(
      "ReachKit stopped its own work today, so no page was written. Nothing about your market changed."
    );
    expect(copy("stopped.work.needs-nothing")).toBe(
      "Nothing is needed from you — ReachKit picks up again on its own."
    );
  });

  it("next-publish law — one of the five lines, slotted, {at}", () => {
    expect(copy("next-publish.scheduled", { at: "Tuesday" })).toBe("Next page goes live Tuesday");
  });

  it("mail — the two opt-out surface lines, one carrying a literal quoted \"stop\"", () => {
    // The confirmation is the approved set's own sentence since issue #372
    // (UI-SPEC S7, ruling 11a), with the address in the slot the set draws
    // it in: the 2026-09-04 ruling wrote a line for a page nobody had drawn
    // yet, and the drawing is the later word on it.
    expect(copy("optout.confirmed", { address: "you@company.com" })).toBe(
      "No more follow-up mail will reach you@company.com — for this domain or any other. " +
        "The page you asked for stays yours."
    );
    expect(copy("optout.invalid")).toBe(
      "That unsubscribe link isn’t valid any more. Reply to any ReachKit email with \"stop\" and we’ll stop by hand."
    );
  });

  it("the one key this ruling did not cover carries the owner's later sentence", () => {
    // `price.vat_included` stood empty, guarded by the empty-value throw,
    // until the owner approved its sentence on 2026-09-10 (#459).
    expect(COPY["price.vat_included"]).toBe("VAT included");
    expect(copy("price.vat_included")).toBe("VAT included");
    expect(OWNER_OWED).not.toContain("price.vat_included");

    // `offer.cancel_self_service` was the other one. It moved to the
    // `TODO(copy)` marker on 2026-09-05 (issue #13) — §4.1 module 6
    // requires the pricing card to carry it, and an empty value would have
    // thrown the whole report screen away — and it is **written now**: the
    // owner's approved screen set draws it under the Start control on both
    // surfaces that carry the offer, unbracketed, which ruling 11a of
    // 2026-09-08 makes approved copy as written (issue #352). Not a
    // sentence supplied on the owner's behalf: their own.
    expect(COPY["offer.cancel_self_service"]).toBe("Cancel in one click.");
    expect(AWAITING_COPY).not.toContain("offer.cancel_self_service");
    expect(OWNER_OWED).not.toContain("offer.cancel_self_service");
  });
});

describe("the five keys the owner ruled 2026-09-11 (DECISIONS 2026-09-11, #516)", () => {
  // The registry's last five owed sentences. Three had stood at the
  // `TODO(copy)` marker — the record's never-checked badge (#459 held it:
  // its drafted sentence clipped the badge at 320 px), the unreadable-site
  // notice #479 minted, and the never-claim tag's remove label #488 minted
  // — and two were approved-set strings (ruling 11a) the owner has since
  // replaced, because both promised a page every day and the Autopilot
  // brief (DECISIONS 2026-09-10) rules that promise out: a day is filled
  // only by an opportunity that passes readiness.
  //
  // Asserted byte for byte, curly apostrophes and em dash as approved, so
  // no later edit can quietly reword an owner's sentence.
  it("the three that stood at the marker carry the owner's sentences", () => {
    expect(COPY["record.verification.never.noLiveAddress"]).toBe("not checked");
    expect(COPY["notice.site-unreadable"]).toBe(
      "We couldn’t read this site’s home page, so nothing here could be measured. Check the address and scan again."
    );
    expect(COPY["settings.voice.remove-claim"]).toBe("Remove {claim}");
    expect(copy("settings.voice.remove-claim", { claim: "cheapest" })).toBe("Remove cheapest");
  });

  it("the two approved-set strings that promised a page a day are replaced", () => {
    expect(COPY["calendar.head"]).toBe("Pages go live when one is ready — at most one a day.");
    expect(COPY["landing.step.3.title"]).toBe("Pages go live on your domain");
    for (const key of ["calendar.head", "landing.step.3.title"] satisfies CopyKey[]) {
      expect(COPY[key], key).not.toContain("every day");
      expect(COPY[key], key).not.toContain("One page a day");
    }
  });

  it("nothing in the registry is owed or awaiting any more, and no key renders the marker", () => {
    expect(OWNER_OWED).toEqual([]);
    expect(AWAITING_COPY).toEqual([]);
    for (const [key, value] of Object.entries(COPY)) {
      expect(value, key).not.toBe(TODO_COPY_MARKER);
      expect(value, key).not.toBe("");
    }
  });
});
