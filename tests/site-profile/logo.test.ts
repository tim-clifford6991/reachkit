// tests/site-profile/logo.test.ts — issue #1069
//
// SPEC §2 2026-09-24: the free scan keeps one logo per site — the first
// usable of apple-touch-icon, a large icon, og:logo or a square og:image,
// and the header's logo image — and a site with none is drawn as a letter.
import { describe, expect, it } from "vitest";
import {
  captureLogo,
  logoCandidates,
  sniffLogo,
} from "@/lib/site-profile/logo";
import type { FetchOutcome } from "@/lib/egress/types";

const HOME = "https://harbour.example/";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ok(raw: Buffer): FetchOutcome {
  return {
    ok: true,
    status: 200,
    url: "",
    html: raw.toString("utf8"),
    bytes: raw.length,
    readAt: new Date(),
    headers: {},
    raw,
  };
}

describe("which of the site's pictures is its logo", () => {
  it("prefers the touch icon, then a large icon, then og:logo, then the header's logo image", () => {
    const html = `<head>
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <meta property="og:logo" content="https://cdn.harbour.example/logo.png">
      <link rel="icon" href="/icon-192.png" sizes="192x192">
      <link rel="apple-touch-icon" href="/apple.png">
    </head><body><header><img class="site-logo" src="/img/logo.svg" alt="Harbour"></header></body>`;
    expect(logoCandidates(html, HOME)).toEqual([
      "https://harbour.example/apple.png",
      "https://harbour.example/icon-192.png",
      "https://cdn.harbour.example/logo.png",
      "https://harbour.example/img/logo.svg",
    ]);
  });

  it("takes an og:image only where the page declares it square", () => {
    const card = `<meta property="og:image" content="/share.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`;
    const square = `<meta property="og:image" content="/mark.png"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512">`;
    expect(logoCandidates(card, HOME)).toEqual([]);
    expect(logoCandidates(square, HOME)).toEqual([
      "https://harbour.example/mark.png",
    ]);
  });

  it("finds nothing on a page that names no mark, so the gallery draws a letter", async () => {
    const html = `<head><title>Harbour</title><link rel="icon" href="/favicon.ico"></head><body><img src="/hero.jpg"></body>`;
    expect(logoCandidates(html, HOME)).toEqual([]);
    expect(
      await captureLogo({ html, homeUrl: HOME }, async () => ok(PNG)),
    ).toBeNull();
  });
});

describe("usable is decided by the bytes", () => {
  it("keeps a picture and skips a page served in its place", async () => {
    const html = `<link rel="apple-touch-icon" href="/gone.png"><link rel="icon" type="image/svg+xml" href="/mark.svg">`;
    const reads: string[] = [];
    const logo = await captureLogo({ html, homeUrl: HOME }, async (url) => {
      reads.push(url);
      return url.endsWith("gone.png")
        ? ok(Buffer.from("<!doctype html><p>Not found</p>"))
        : ok(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'));
    });
    expect(reads).toEqual([
      "https://harbour.example/gone.png",
      "https://harbour.example/mark.svg",
    ]);
    expect(logo?.type).toBe("image/svg+xml");
    expect(logo?.source).toBe("https://harbour.example/mark.svg");
  });

  it("names each picture format by its first bytes", () => {
    expect(sniffLogo(PNG)).toBe("image/png");
    expect(sniffLogo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffLogo(Buffer.from([0, 0, 1, 0, 1, 0]))).toBe("image/x-icon");
    expect(sniffLogo(Buffer.from('<?xml version="1.0"?>\n<svg></svg>'))).toBe(
      "image/svg+xml",
    );
    expect(sniffLogo(Buffer.from("<html><svg></svg></html>"))).toBeNull();
  });
});
