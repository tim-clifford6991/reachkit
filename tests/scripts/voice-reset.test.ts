// The 0¢ retrofit: a stored voice that describes the failed read is cleared by
// one guarded update, and a voice that describes the site, or the customer's
// own stamped words, is never touched.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resets } from "../../scripts/voice-reset/run";

const BAKERY = JSON.parse(readFileSync(new URL("../site-profile/fixtures/baeckerei-hinkel.de.json", import.meta.url), "utf8")) as { storedVoice: string };

describe("voice reset", () => {
  it("clears the bakery's stored voice and its unstamped seed, and nothing else", () => {
    const out = resets({
      profiles: [
        { domain: "baeckerei-hinkel.de", text: BAKERY.storedVoice, tone: "neutral" },
        { domain: "example.com", text: "Plain and direct, second person.", tone: "plain" },
      ],
      sites: [
        { id: "bakery", voice_text: BAKERY.storedVoice },
        { id: "other", voice_text: "Warm and short." },
      ],
    });

    expect(out.profiles).toHaveLength(1);
    expect(out.profiles[0]).toContain("domain = 'baeckerei-hinkel.de'");
    expect(out.sites).toHaveLength(1);
    expect(out.sites[0]).toContain("id = 'bakery' and voice_edited_at is null");
  });
});
