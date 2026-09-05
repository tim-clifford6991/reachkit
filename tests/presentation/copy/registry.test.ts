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

const KEY_FILES = fs.readdirSync(KEYS_DIR).filter((f) => f.endsWith(".ts")).sort();
const KEY_SOURCES = new Map(KEY_FILES.map((f) => [f, fs.readFileSync(path.join(KEYS_DIR, f), "utf8")]));
const REGISTRY_SOURCE = fs.readFileSync(path.join(COPY_DIR, "registry.ts"), "utf8");

// A partition's exported const, keyed by its own file name, read directly
// off disk rather than through `COPY` — needed for the "traces to exactly
// one partition" and "no cross-partition import" checks below, which must
// see each partition in isolation before it is merged.
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

    // Count assertion (rule 5.5): the thirteen band/severity/score words,
    // plus WO-070's eight now-ruled landing keys (headline, field label,
    // submit label — ruled 2026-09-03; the five `landing.problem.*` lines
    // — ruled 2026-09-04; both dates WO-070 `## Log`): 13 + 8 = 21, plus
    // the thirteen keys the owner ruled 2026-09-04 across offer.ts (7),
    // mail.ts (2), laws.ts (3) and report.ts (1) (WO-041 `## Log`, this
    // date's ruling): 21 + 13 = 34. WO-278 adds one more filled key
    // (`unmeasured.dash` → "—", a transcription on the same footing as
    // the thirteen band words): 34 + 1 = 35.
    //
    // WO-287 (owner ruling 2026-09-04, sheet 2 — `registry/evidence/
    // RULING-copy-2026-09-04.json`) fills five keys that were previously
    // owner-owed (`verdict.limiting.foundations/answerability/presence` in
    // report.ts, `unmeasured.undeterminable`/`unmeasured.not-attempted` in
    // laws.ts) — 35 + 5 = 40 — and adds thirteen new, already-filled keys
    // for the report address's sentences (`removal.*`, `notice.*`,
    // `control.*`, `copy-link.label`, all in report.ts) — 40 + 13 = 53.
    //
    // 2026-09-05, issue #30 (the mail seam, BUILD §12): six keys added in
    // `mail.ts`. Five are owner-owed and empty — the nothing-to-report
    // line, the two measurement lines and the two stop-control labels —
    // and one is filled: `mail.shell.wordmark` → "ReachKit", the product's
    // own name transcribed, on the same footing as `unmeasured.dash`'s
    // "—" and `removal.address`. 53 + 1 = 54.
    //
    // 2026-09-05, separately: issue #9 (the app shell, BUILD §4.4) adds
    // five filled `shell.*` keys in `laws.ts`, each a transcription of a
    // word `BUILD.md` §4.4 or §4.3 prints — the three destination names
    // and the two publishing modes: 54 + 5 = 59.
    //
    // 2026-09-05, separately again: issue #13 (the free report screen)
    // brings a third standing of a key — `AWAITING_COPY`, the
    // `TODO(copy)` marker `CLAUDE.md` prescribes. Such a key renders (it
    // is not empty, so `copy()` does not throw) but carries no owner
    // sentence, so it is *not* one of the ruled ones. The count below is
    // therefore split rather than raised: the number of genuinely ruled
    // sentences is still 59, and every key that renders without one is
    // counted separately, which is what keeps this assertion meaning what
    // it said before the marker existed.
    //
    // 2026-09-05, separately again: issue #19 (REQ-098) adds six ruled
    // sentences — REQ-098 criterion 2 states them verbatim as the owner's
    // own transcription. 59 + 6 = 65.
    const awaiting = new Set<CopyKey>(AWAITING_COPY);
    const ruled = nonOwnerOwed.filter((key) => !awaiting.has(key));
    expect(ruled.length).toBe(65);

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
  it("keys/ holds exactly thirteen partition files", () => {
    expect(KEY_FILES).toEqual([
      "bands.ts",
      "calendar.ts",
      "danger.ts",
      "draft.ts",
      "laws.ts",
      "mail.ts",
      "offer.ts",
      "overview.ts",
      "publish.ts",
      "report.ts",
      "settings.ts",
      "setup.ts",
      "signin.ts",
    ]);
  });

  it("registry.ts imports every file under keys/, and no fourteenth", () => {
    const importedKeyFiles = [...REGISTRY_SOURCE.matchAll(/from\s+["']\.\/keys\/([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((f): f is string => f !== undefined);
    expect(new Set(importedKeyFiles)).toEqual(new Set(KEY_FILES));
    expect(importedKeyFiles).toHaveLength(13);
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

  it("counts: 27 owner-owed, 59 filled, 86 total (rule 5.5 — the index states its own coverage)", () => {
    // WO-070 added report.ts's eight landing keys (headline, field label,
    // submit label, five DomainProblem lines), all owner-owed: 30 + 8 = 38.
    // 2026-09-03: the owner ruled on three of them (headline, field label,
    // submit label — WO-070 `## Log`), so 38 - 3 = 35 remained owner-owed
    // and 13 + 3 = 16 were filled. 2026-09-04: the owner ruled on the
    // remaining five (the `landing.problem.*` lines — WO-070 `## Log`),
    // so 35 - 5 = 30 remain owner-owed and 16 + 5 = 21 are filled; the
    // total is unchanged at 51.
    //
    // 2026-09-04, separately: the owner ruled on thirteen more keys
    // (WO-041 `## Log`, this date's ruling) — `price.amount`,
    // `price.interval`, `offer.cadence.page`, `offer.cadence.measure`,
    // `offer.cadence.movement`, `offer.veto.window`, `offer.start`,
    // `place.report.first-page.rival`, `stopped.work.line`,
    // `stopped.work.needs-nothing`, `next-publish.scheduled`,
    // `optout.confirmed`, `optout.invalid` — filled verbatim, byte for
    // byte. 30 - 13 = 17 remain owner-owed and 21 + 13 = 34 are filled;
    // the total is unchanged at 51. `price.vat_included` and
    // `offer.cancel_self_service` were not part of this ruling (no owner
    // string was supplied for either) and remain owner-owed.
    //
    // 2026-09-04, separately again: WO-278 adds six keys. Three in
    // `report.ts` (`verdict.limiting.foundations/answerability/presence`,
    // BP-024 decision 6, rule 1.1) and two in `laws.ts`
    // (`unmeasured.undeterminable`, `unmeasured.not-attempted`) are
    // owner-owed and empty — the two REQ-004 c6/c9 sentences and the
    // three limiting-factor lines are all customer-visible strings and
    // therefore the owner's (constitution §1). One in `laws.ts`
    // (`unmeasured.dash` → "—") carries a value, a transcription of
    // REQ-004's own character. 17 + 5 = 22 owner-owed, 34 + 1 = 35
    // filled, 51 + 6 = 57 total.
    //
    // 2026-09-04, separately again: WO-287 (owner ruling 2026-09-04, sheet
    // 2) fills the five keys the previous paragraph left owner-owed
    // (`verdict.limiting.foundations/answerability/presence`,
    // `unmeasured.undeterminable`, `unmeasured.not-attempted`) — 22 - 5 =
    // 17 remain owner-owed and 35 + 5 = 40 are filled — and adds thirteen
    // new, already-filled keys in `report.ts` for the report address's
    // sentences (`removal.address`, `removal.line.on-report`,
    // `removal.line.removed`, `notice.incomplete`,
    // `notice.measurement-failed`, `notice.correction-failed`,
    // `notice.refused.network-limit`, `notice.refused.scan-running`,
    // `control.rescan-age`, `control.rescan-incomplete`, `control.retry`,
    // `control.correction-retry`, `copy-link.label`) — 40 + 13 = 53 filled,
    // 17 owner-owed, 57 + 13 = 70 total.
    //
    // 2026-09-05, issue #30 (the mail seam, BUILD §12): six keys in
    // `mail.ts` — five owner-owed (`mail.nothing_to_report`,
    // `mail.week_unmeasured`, `mail.week_partly_measured`,
    // `mail.unsubscribe.label`, `mail.optout.label`) and one filled
    // (`mail.shell.wordmark`). 17 + 5 = 22 owner-owed, 53 + 1 = 54
    // filled, 70 + 6 = 76 total.
    //
    // 2026-09-05, separately: issue #9 (the app shell, BUILD §4.4,
    // REQ-040) adds ten keys. Five are filled and every one is a
    // transcription of a word `BUILD.md` itself prints, on the same
    // footing as the thirteen band words — `laws.ts`'s
    // `shell.nav.overview`/`.calendar`/`.settings` (§4.4's "nav
    // **Overview / Calendar / Settings**") and
    // `shell.publishing.mode.autopilot`/`.copilot` (§4.3's "Autopilot
    // (default, selected) vs Copilot"). Five are owner-owed and empty:
    // `laws.ts`'s `shell.domain.measured-weeks` and
    // `shell.domain.not-measured` (REQ-040 c6 and c7's own written lines)
    // and one `*.head` line each in `overview.ts`, `calendar.ts` and
    // `settings.ts`, the sentence each screen states inside the shell
    // until its own content lands (#15, #16, #18). 22 + 5 = 27
    // owner-owed, 54 + 5 = 59 filled, 76 + 10 = 86 total.
    //
    // 2026-09-05, separately again: issue #31 (lead capture and the
    // giveaway, BUILD §4.2) adds twenty keys in `mail.ts`, every one
    // owner-owed and empty — the five the first-page mail speaks, the six
    // the unavailable notice speaks (its subject and one line per
    // `FirstPageFailure`), the six the three nurture touches speak, the
    // three `POST /api/lead` answers with, and the opt-out page's third
    // arm. Not one of them is written by this feature (constitution §1).
    // 27 + 20 = 47 owner-owed, 59 filled unchanged, 86 + 20 = 106 total.
    //
    // 2026-09-05, separately again: issue #13 (the free report screen)
    // mints 67 new keys for `BUILD.md` §4.1's modules and the six scan
    // stages, all carrying `CLAUDE.md`'s `TODO(copy)` marker, and moves
    // two keys off the empty-value representation onto the same marker
    // (`offer.cancel_self_service`, which §4.1 module 6 has to speak, and
    // `generated.page.proposed`, which `renderGenerated` resolves for the
    // free-page card's label). So: 47 - 2 = 45 owner-owed and empty, 67 +
    // 2 = 69 awaiting copy and rendering the marker, 59 ruled — 106 + 67 =
    // 173 total. The three numbers are asserted separately on purpose: a
    // key that quietly moved from "the owner still owes this" to "someone
    // wrote something" fails here rather than passing on a total that
    // happens to add up.
    //
    // 2026-09-05, separately again: issue #19 (/pricing and the sign-in
    // screen, REQ-098) adds eleven keys in the new `signin.ts` partition —
    // six ruled, because REQ-098 criterion 2 states them verbatim as the
    // owner's own transcription (`signin.heading`, `signin.body`,
    // `signin.field.placeholder`, `signin.submit.label`,
    // `signin.new.prompt`, `signin.new.link`), and five carrying the
    // marker, being exactly the lines REQ-098's third open question
    // records as written nowhere (`signin.link_sent`,
    // `signin.payment_held`, `signin.no_account`,
    // `signin.address.invalid`, `signin.link_dead`). It also moves
    // `price.vat_included` off the empty value onto the marker, on the
    // same ground #13 moved `offer.cancel_self_service`: `/pricing` has to
    // speak it, and an empty value would take the whole surface down
    // rather than show the owner the one line still owed. So: 45 - 1 = 44
    // owner-owed and empty, 69 + 5 + 1 = 75 awaiting copy, 59 + 6 = 65
    // ruled — 173 + 11 = 184 total.
    expect(OWNER_OWED.length).toBe(44);
    expect(AWAITING_COPY.length).toBe(75);
    expect(Object.keys(COPY).length - OWNER_OWED.length - AWAITING_COPY.length).toBe(65);
    expect(Object.keys(COPY).length).toBe(184);

    // The two representations never overlap: an empty value and the marker
    // are different values, so no key can be on both lists.
    for (const key of AWAITING_COPY) expect(OWNER_OWED).not.toContain(key);
    for (const key of AWAITING_COPY) expect(COPY[key]).toBe(TODO_COPY_MARKER);
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
    expect(copy("optout.confirmed")).toBe(
      "You’re unsubscribed. ReachKit won’t email you again — about this site or any other."
    );
    expect(copy("optout.invalid")).toBe(
      "That unsubscribe link isn’t valid any more. Reply to any ReachKit email with \"stop\" and we’ll stop by hand."
    );
  });

  it("the two keys this ruling did not cover still carry no owner sentence", () => {
    // `price.vat_included` is unchanged: no surface renders it, so the
    // empty-value throw still guards it.
    expect(COPY["price.vat_included"]).toBe("");
    expect(() => copy("price.vat_included")).toThrow(/owner-owed/);

    // `offer.cancel_self_service` moved to the `TODO(copy)` marker on
    // 2026-09-05 (issue #13): `BUILD.md` §4.1 module 6 requires the
    // pricing card to carry it, and an empty value would throw the whole
    // report screen away rather than show the owner an unwritten line. It
    // is still unwritten, and this asserts exactly that — the marker, not
    // a sentence somebody supplied on the owner's behalf.
    expect(COPY["offer.cancel_self_service"]).toBe(TODO_COPY_MARKER);
    expect(AWAITING_COPY).toContain("offer.cancel_self_service");
  });
});
