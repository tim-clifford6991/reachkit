// The mail's brand head is the mark as an image, never inline SVG (#1121):
// Gmail and Outlook strip `<svg>`, which left the violet cell behind it as
// a plain square.
import { describe, expect, it } from "vitest";
import { render } from "react-email";
import { MailDocument } from "@/lib/mail/shell/document";

describe("#1121 — the mail head shows the logo in every inbox", () => {
  it("draws the mark as a 28px image of the public 96px file, with the wordmark as its alt", async () => {
    const html = await render(
      MailDocument({
        wordmark: "ReachKit",
        rows: null,
        actions: null,
        wholeMailLine: null,
        reason: null,
        imprint: null,
        plainTextNote: "",
        optOut: null,
        links: [],
      })
    );
    const img = html.match(/<img[^>]*>/g) ?? [];
    expect(img).toHaveLength(1);
    expect(img[0]).toContain('src="https://reachkit.app/brand/mark-96.png"');
    expect(img[0]).toContain('alt="ReachKit"');
    expect(img[0]).toContain('width="28"');
    expect(img[0]).toContain('height="28"');
    expect(html).not.toContain("<svg");
  });
});
