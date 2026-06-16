import { describe, it, expect } from "vitest";
import { detectChannels } from "./fingerprint";

describe("detectChannels", () => {
  it("detects owned channels from outbound links", () => {
    const html = `<footer>
      <a href="https://www.youtube.com/@acmehq">YouTube</a>
      <a href="https://acme.substack.com">Newsletter</a>
      <a href="https://github.com/acme">GitHub</a>
      <a href="https://twitter.com/acme">Twitter</a>
    </footer>`;
    const channels = detectChannels(html);
    const kinds = channels.map((c) => c.kind).sort();
    expect(kinds).toEqual(["github", "newsletter", "youtube"]);
    expect(channels.find((c) => c.kind === "youtube")?.url).toBe(
      "https://www.youtube.com/@acmehq",
    );
  });

  it("returns one channel per kind (first match wins)", () => {
    const html = `<a href="https://dev.to/alice">a</a><a href="https://dev.to/bob">b</a>`;
    const channels = detectChannels(html);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.url).toBe("https://dev.to/alice");
  });

  it("returns [] when nothing matches", () => {
    expect(detectChannels("<p>no links</p>")).toEqual([]);
  });

  it("with a brand token, keeps only brand-related handles (rejects third-party links)", () => {
    const html = `
      <a href="https://github.com/twbs">bootstrap</a>
      <a href="https://www.youtube.com/@forbes">our channel</a>`;
    const channels = detectChannels(html, "forbes");
    // github.com/twbs is unrelated → dropped; the forbes YouTube → kept
    expect(channels.map((c) => c.kind)).toEqual(["youtube"]);
  });

  it("picks the brand-matching link even when a third-party one appears first", () => {
    const html = `
      <a href="https://github.com/twbs">bootstrap</a>
      <a href="https://github.com/stripe">us</a>`;
    const channels = detectChannels(html, "stripe");
    expect(channels[0]?.url).toBe("https://github.com/stripe");
  });
});
