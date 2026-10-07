// tests/market/rivals/verify.test.ts — issue 1314.
//
// A rival's domain is checked before it is kept. The cases are the customer
// panel's own: Chili Piper was stored as `piper.com`, a real site that is
// another company's, and two of a plumber's five rivals were at domains no
// site answers at.
import { describe, expect, it } from "vitest";
import type { FetchOutcome } from "@/lib/egress/types";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { domainGuesses, pageNames, verifyRivalDomains } from "@/lib/market/rivals/verify";

const AT = new Date("2026-10-07T12:00:00Z");
const rival = (domain: string, name: string): RivalConclusion => ({ domain, name, basis: "same_job", reason: "", searchNames: [name.toLowerCase()] });
/** A page with enough on it to be judged, as a real home page has. */
const html = (title: string, text: string): string =>
  `<html><head><title>${title}</title></head><body><p>${text}</p><p>${"We have served our customers every working day since we opened our doors. ".repeat(5)}</p></body></html>`;

type Site = string | "dns" | "status" | "timeout" | { status: number; html: string } | { servedFrom: string; html: string };

/** A web of home pages: a string is the page, a reason is why it did not load. */
function web(sites: Record<string, Site>) {
  return async (url: string): Promise<FetchOutcome> => {
    const site = sites[new URL(url).hostname] ?? "dns";
    if (site === "dns" || site === "status" || site === "timeout") return { ok: false, reason: site, url, readAt: AT };
    const page = typeof site === "string" ? { status: 200, html: site, url } : "servedFrom" in site ? { status: 200, html: site.html, url: site.servedFrom } : { ...site, url };
    return { ok: true, status: page.status, url: page.url, html: page.html, bytes: page.html.length, readAt: AT, headers: {} };
  };
}

describe("a rival is kept only at a domain that is its own", () => {
  it("puts a rival at another company's domain right where its own names it", async () => {
    const checked = await verifyRivalDomains({
      rivals: [rival("calendly.com", "Calendly"), rival("piper.com", "Chili Piper")],
      own: "savvycal.com",
      read: web({
        "calendly.com": html("Calendly", "Easy scheduling ahead."),
        "piper.com": html("Piper Aircraft", "Freedom of flight."),
        "chilipiper.com": html("Chili Piper | Demand conversion", "Chili Piper turns inbound leads into meetings."),
      }),
    });
    expect(checked.rivals.map((r) => r.domain)).toEqual(["calendly.com", "chilipiper.com"]);
    expect(checked.fixed).toEqual([{ name: "Chili Piper", from: "piper.com", to: "chilipiper.com" }]);
  });

  it("drops a rival no site answers for, and one whose only site is somebody else's", async () => {
    const checked = await verifyRivalDomains({
      rivals: [rival("rotorooter.com", "Roto-Rooter"), rival("pipelineaustin.com", "Pipeline Plumbing"), rival("abcplumbingaustin.com", "ABC Home & Commercial Services")],
      own: "austinplumbery.com",
      read: web({
        "rotorooter.com": html("Roto-Rooter Plumbing & Water Cleanup", "Call Roto-Rooter."),
        "abcplumbingaustin.com": html("Domain for sale", "Buy this domain."),
      }),
    });
    expect(checked.rivals.map((r) => r.domain)).toEqual(["rotorooter.com"]);
    expect(checked.dropped).toEqual([
      { name: "Pipeline Plumbing", domain: "pipelineaustin.com", because: "no_site" },
      { name: "ABC Home & Commercial Services", domain: "abcplumbingaustin.com", because: "another_site" },
    ]);
  });

  it("keeps a rival whose page would not be read: a refusal, a rate limit and an empty shell prove nothing against it", async () => {
    const checked = await verifyRivalDomains({
      rivals: [rival("mrrooter.com", "Mr. Rooter Plumbing"), rival("grantthornton.co.uk", "Grant Thornton"), rival("inkbox.com", "Inkbox"), rival("ustwo.com", "ustwo")],
      own: "austinplumbery.com",
      read: web({
        "mrrooter.com": "status",
        "grantthornton.co.uk": "timeout",
        "inkbox.com": { status: 429, html: "local_rate_limited" },
        "ustwo.com": `<html><head><title></title></head><body><div id="root"></div><script>window.__DATA__ = ${JSON.stringify("x".repeat(900))}</script></body></html>`,
      }),
    });
    expect(checked.rivals).toHaveLength(4);
    expect(checked.dropped).toEqual([]);
  });

  it("reads the name in a long page's title, and follows a home page that moved to the rival's new domain", async () => {
    const long = `<html><head><style>${"a{color:red}".repeat(9000)}</style><title>ustwo | Digital Product Studio</title></head><body>${"<p>We design and build digital products.</p>".repeat(20)}</body></html>`;
    const checked = await verifyRivalDomains({
      rivals: [rival("ustwo.com", "ustwo"), rival("mazars.co.uk", "Forvis Mazars")],
      own: "alexander.co.uk",
      read: web({ "ustwo.com": long, "mazars.co.uk": { servedFrom: "https://www.forvismazars.com/uk/en", html: html("Forvis Mazars Accountants", "Audit, tax and advisory.") } }),
    });
    expect(checked.rivals.map((r) => r.domain)).toEqual(["ustwo.com", "forvismazars.com"]);
    expect(checked.fixed).toEqual([{ name: "Forvis Mazars", from: "mazars.co.uk", to: "forvismazars.com" }]);
  });

  it("never puts a rival at the business's own domain, and keeps one rival a domain", async () => {
    const checked = await verifyRivalDomains({
      rivals: [rival("acme.io", "Acme"), rival("acme-app.com", "Acme")],
      own: "acme.com",
      read: web({ "acme.com": html("Acme", "Acme."), "acme.io": html("Acme", "Acme."), "acme-app.com": html("Parked", "Nothing here.") }),
    });
    expect(checked.rivals.map((r) => r.domain)).toEqual(["acme.io"]);
  });
});

describe("a page names a rival however the name is written", () => {
  it("reads through an ampersand, an accent and a trademark sign", () => {
    expect(pageNames(html("Radiant Plumbing and Air Conditioning", ""), rival("radiantplumbing.com", "Radiant Plumbing & Air Conditioning"))).toBe(true);
    expect(pageNames(html("Mr. Rooter® Plumbing", ""), rival("mrrooter.com", "Mr. Rooter Plumbing"))).toBe(true);
    expect(pageNames(html("Bäckerei Schüren", ""), rival("baeckerei-schueren.de", "Backerei Schuren"))).toBe(true);
    expect(pageNames(html("Piper Aircraft", ""), rival("piper.com", "Chili Piper"))).toBe(false);
  });

  it("looks for a rival's own domain in what the pass saw before it guesses one", () => {
    expect(domainGuesses(rival("piper.com", "Chili Piper"), ["chilipiper.io", "calendly.com"])).toEqual(["chilipiper.io", "chilipiper.com"]);
    expect(domainGuesses(rival("mazars.fr", "Forvis Mazars"), [])).toEqual(["forvismazars.com", "forvismazars.fr"]);
  });
});
