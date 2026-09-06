// tests/publish/setup/cards.test.ts — BUILD §4.3, REQ-028 criteria 1, 2, 3, 4
//
// The mode and destination cards' data. The archived test plan is WO-221's;
// each criterion is quoted from REQ-028 as it stands on disk.
import { describe, expect, it } from "vitest";
import { dnsRecordFor, preselected, setupCards } from "@/lib/publish/setup/cards";
import { COPY, type CopyKey } from "@/lib/presentation/copy";
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";

const TARGET = "content.dev.reachkit.app";

describe('c1 — "autopilot is pre-selected, copilot is one click away, and each states in one written line what it means for them"', () => {
  const cards = setupCards({ siteDomain: "example.com", cnameTarget: TARGET });

  it("both modes are present in the same card pair, autopilot pre-selected and copilot not", () => {
    expect(cards.mode.map((o) => [o.mode, o.preselected])).toEqual([
      ["autopilot", true],
      ["copilot", false],
    ]);
  });

  it("each mode carries its own distinct written line, as a key — this module writes no sentence", () => {
    const keys = cards.mode.map((o) => o.copy);
    expect(new Set(keys).size).toBe(2);
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
    }
  });

  it("the mode names are the registry's, shared with the shell — one word, one key", () => {
    expect(cards.mode.map((o) => o.name)).toEqual([
      "shell.publishing.mode.autopilot",
      "shell.publishing.mode.copilot",
    ]);
  });
});

describe('c2 — "a blog on their own domain is pre-selected, and the DNS record they will need is shown to them once their site address is known"', () => {
  it("hosted is pre-selected and wordpress is not", () => {
    const cards = setupCards({ siteDomain: "example.com", cnameTarget: TARGET });
    expect(cards.destination.map((o) => [o.kind, o.preselected])).toEqual([
      ["hosted", true],
      ["wordpress", false],
    ]);
  });

  it("the record is §9's content.{customer-domain} CNAME, pointed at the edge binding", () => {
    expect(dnsRecordFor({ siteDomain: "example.com", cnameTarget: TARGET })).toEqual({
      type: "CNAME",
      name: `${HOSTED_SUBDOMAIN_LABEL}.example.com`,
      value: TARGET,
    });
  });

  it("the edge hostname is never a string in the card — it is only ever what the caller passed", () => {
    const record = dnsRecordFor({ siteDomain: "example.com", cnameTarget: "somewhere.else.test" });
    expect("value" in record && record.value).toBe("somewhere.else.test");
  });

  it("only hosted carries a dns shape; wordpress carries none", () => {
    const cards = setupCards({ siteDomain: "example.com", cnameTarget: TARGET });
    expect(cards.destination.find((o) => o.kind === "hosted")?.dns).toBeDefined();
    expect(cards.destination.find((o) => o.kind === "wordpress")?.dns).toBeUndefined();
  });
});

describe('c2 — "one written line says the record appears once they have entered their site address, rather than a blank or a placeholder standing where it will sit"', () => {
  it("no site address yields the pending shape, carrying its own key", () => {
    expect(dnsRecordFor({ siteDomain: null, cnameTarget: TARGET })).toEqual({
      pending: "no_domain_yet",
      copy: "setup.destination.dnsPending",
    });
  });

  it("no blank, dash or placeholder value can be produced — the type has exactly two shapes", () => {
    const dns = setupCards({ siteDomain: null, cnameTarget: TARGET }).destination.find(
      (o) => o.kind === "hosted"
    )?.dns;
    expect(dns).toBeDefined();
    for (const forbidden of [null, undefined, "", "—", "-", "n/a", "TBD"]) {
      expect(dns).not.toBe(forbidden);
    }
    // Enumerated rather than asserted in prose: every value the shape can
    // hold is a non-empty string, in both arms.
    for (const value of Object.values(dns as unknown as Record<string, string>)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(["—", "-", "n/a", "TBD"]).not.toContain(value);
    }
  });
});

describe('c3 and c4 — "they can defer connecting it and setup still completes"', () => {
  it("wordpress is present as an option and needs nothing connected to be chosen", () => {
    const wordpress = setupCards({ siteDomain: null, cnameTarget: TARGET }).destination.find(
      (o) => o.kind === "wordpress"
    );
    expect(wordpress).toBeDefined();
    expect(wordpress?.dns).toBeUndefined();
  });

  it("both cards render fully with no site address at all — nothing here waits on DNS", () => {
    const cards = setupCards({ siteDomain: null, cnameTarget: TARGET });
    expect(cards.mode).toHaveLength(2);
    expect(cards.destination).toHaveLength(2);
  });
});

describe("the defaults are data on the option, not a fallback", () => {
  it("preselected() reads the pair itself, so what was shown and what is recorded are one fact", () => {
    expect(preselected(setupCards({ siteDomain: null, cnameTarget: TARGET }))).toEqual({
      mode: "autopilot",
      destination: "hosted",
    });
  });

  it("exactly one option in each pair is pre-selected", () => {
    const cards = setupCards({ siteDomain: "example.com", cnameTarget: TARGET });
    expect(cards.mode.filter((o) => o.preselected)).toHaveLength(1);
    expect(cards.destination.filter((o) => o.preselected)).toHaveLength(1);
  });
});

describe("no sentence, and no network call", () => {
  it("every string this module produces is either a copy key or a hostname — never a sentence", () => {
    const cards = setupCards({ siteDomain: "example.com", cnameTarget: TARGET });
    const keys: CopyKey[] = [
      ...cards.mode.flatMap((o) => [o.name, o.copy] as CopyKey[]),
      ...cards.destination.flatMap((o) => [o.name, o.copy] as CopyKey[]),
    ];
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
    }
    // Nothing in the produced data contains a space followed by a
    // lower-case word — the crude shape of a sentence — outside the copy
    // keys themselves.
    const hostnames = [
      ...cards.destination.flatMap((o) =>
        o.dns && "name" in o.dns ? [o.dns.name, o.dns.value] : []
      ),
    ];
    for (const hostname of hostnames) {
      expect(hostname).not.toMatch(/\s/);
    }
  });

  it("makes no network call: fetch is not reachable from this module (tests/setup.ts refuses one)", () => {
    // `tests/setup.ts` replaces `fetch`, `http.request` and `https.request`
    // with throwing stubs for every test in this corpus. The two calls
    // above therefore *are* the assertion: they returned, so nothing here
    // reached a resolver, a vendor or the edge.
    expect(() => setupCards({ siteDomain: "example.com", cnameTarget: TARGET })).not.toThrow();
    expect(() => dnsRecordFor({ siteDomain: null, cnameTarget: TARGET })).not.toThrow();
  });
});
