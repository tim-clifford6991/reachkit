// A German site's own pages are written in German (SPEC §6, D66, issue 1311;
// ReachKit's own screens and mail stay English, issue 1443), and a translated sentence can never say less than its key
// promises: it fills the same slots, and a key with no translation is shown
// in English rather than breaking the screen.
import { describe, expect, it } from "vitest";
import { COPY, COPY_META, TODO_COPY_MARKER, copy, type CopyKey } from "@/lib/presentation/copy";
import { TRANSLATIONS, copyIn, translationOf } from "@/lib/presentation/copy/translated";

const slotsIn = (text: string): string[] => [...new Set([...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]!))].sort();

describe("the German overlay", () => {
  const partitions = Object.entries(TRANSLATIONS.de ?? {});

  it.each(partitions)("%s: every sentence is on a registry key and fills that key's slots", (_name, sentences) => {
    const wrong: string[] = [];
    for (const [key, text] of Object.entries(sentences)) {
      if (!(key in COPY)) {
        wrong.push(`${key}: not a registry key`);
        continue;
      }
      const declared = Object.keys(COPY_META[key as CopyKey].slots).sort();
      if (text === undefined || text.trim() === "" || text.includes(TODO_COPY_MARKER)) wrong.push(`${key}: no sentence`);
      else if (JSON.stringify(slotsIn(text)) !== JSON.stringify(declared.filter((slot) => COPY[key as CopyKey].includes(`{${slot}}`)))) {
        wrong.push(`${key}: slots ${slotsIn(text).join(",") || "none"}, the key has ${declared.join(",") || "none"}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("writes a German page's sentence with its slot filled, and an English page's from the registry", () => {
    const key = "hosted.visit" satisfies CopyKey;
    const german = translationOf(key, "de");
    expect(german).toBeDefined();
    expect(copyIn("de", key, { site: "cafe.example" })).toBe(german!.replace("{site}", "cafe.example"));
    expect(copyIn("en", key, { site: "cafe.example" })).toBe(copy(key, { site: "cafe.example" }));
  });

  it("shows English for a key the overlay does not hold, and still refuses a missing slot", () => {
    const untranslated = (Object.keys(COPY) as CopyKey[]).find(
      (key) => translationOf(key, "de") === undefined && Object.keys(COPY_META[key].slots).length === 0 && COPY[key] !== ""
    )!;
    expect(copyIn("de", untranslated)).toBe(copy(untranslated));
    expect(() => copyIn("de", "ai-answers.reused-from")).toThrow(/date/);
  });
});
