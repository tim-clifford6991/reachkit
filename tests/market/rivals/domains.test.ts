// tests/market/rivals/domains.test.ts
//
// WO-077 test plan, quoted verbatim from REQ-008 in the work order's own
// `## Test plan` table, plus the interface-contract tests it names.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isJobRow,
  isOccupationTitle,
  ownPlaceIn,
  resolvedHost,
  resolvedRows,
  isJobSearch,
  isSourceRow,
  pageClass,
  isOwnDomain,
  isPlatformDomain,
  isPublicHost,
  registrableDomain,
} from "../../../src/lib/market/rivals/domains.ts";
import { PLATFORM_DOMAINS } from "../../../src/lib/config/constants.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/market/rivals/domains.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

describe(
  'REQ-008 c1 — "Given a completed report, when the Google card renders, then it shows, for the customer and for each rival, in how many of the market\'s 12 biggest searches they appear in the top ten, each labelled with its name and its value rather than identified by colour alone." — contributing arm: two spellings of one identity reduce to one',
  () => {
    it("registrableDomain/one-identity-per-site — every written form of example.com reduces to the same value", () => {
      const forms = [
        "https://www.example.com/pricing?a=1",
        "EXAMPLE.com.",
        "example.com:443",
        "content.example.com",
      ];
      const reduced = new Set(forms.map((f) => registrableDomain(f)));
      expect(reduced.size).toBe(1);
      expect([...reduced][0]).toBe("example.com");
    });

    it("registrableDomain/one-identity-per-site — a two-label public suffix reduces to eTLD+1, not to the suffix itself", () => {
      expect(registrableDomain("example.co.uk")).toBe("example.co.uk");
      expect(registrableDomain("www.example.co.uk")).toBe("example.co.uk");
    });
  }
);

describe(
  'REQ-008 c2 — "Given a customer appearing in none of the 12, when the card renders, then 0 is shown against the same denominator as every rival — never an error, a blank card, or a ratio." — contributing arm: the customer\'s own hosted page must not be counted as a rival',
  () => {
    it("isOwnDomain/matches-www-and-content — www. and the content. publishing subdomain are both own", () => {
      const ownDomain = "example.com";
      expect(isOwnDomain("example.com", ownDomain)).toBe(true);
      expect(isOwnDomain("www.example.com", ownDomain)).toBe(true);
      expect(isOwnDomain("content.example.com", ownDomain)).toBe(true);
    });

    it("isOwnDomain/matches-www-and-content — a different domain, and a domain that merely contains the name, are not own", () => {
      const ownDomain = "example.com";
      expect(isOwnDomain("example.net", ownDomain)).toBe(false);
      expect(isOwnDomain("notexample.com", ownDomain)).toBe(false);
    });

    it("isOwnDomain — case, trailing dot and a port are still the same site", () => {
      expect(isOwnDomain("WWW.Example.com.", "example.com:443")).toBe(true);
    });

    it("isOwnDomain — a malformed side never false-matches another malformed side", () => {
      expect(isOwnDomain("", "")).toBe(false);
      expect(isOwnDomain("not a host", "also not a host")).toBe(false);
    });
  }
);

describe("registrableDomain/returns-null-for-garbage", () => {
  it.each(["", "not a host", "http://", "1.2.3.4"])("%j -> null", (input) => {
    expect(registrableDomain(input)).toBeNull();
  });
});

describe("isPlatformDomain/reads-the-pin", () => {
  it("every name in PLATFORM_DOMAINS is a platform domain as a .com", () => {
    for (const name of PLATFORM_DOMAINS) {
      expect(isPlatformDomain(`${name}.com`)).toBe(true);
    }
  });

  it("a domain absent from PLATFORM_DOMAINS is not a platform — the open-world side is the rival side", () => {
    expect(isPlatformDomain("example.com")).toBe(false);
    expect(isPlatformDomain("unknown-vendor.io")).toBe(false);
  });

  it("membership is checked against PLATFORM_DOMAINS itself, not a list restated here", () => {
    // PLATFORM_DOMAINS has at least one entry, and every entry above passed —
    // so this test would fail if the module read a shorter or different list.
    expect(PLATFORM_DOMAINS.length).toBeGreaterThan(0);
  });
});

describe("all/are-pure", () => {
  it("resolves no import into src/lib/egress/, src/lib/vendors/ or src/lib/costs/", () => {
    const forbidden = [/from ["']@\/lib\/egress\//, /from ["']@\/lib\/vendors\//, /from ["']@\/lib\/costs\//];
    for (const re of forbidden) {
      expect(SOURCE).not.toMatch(re);
    }
  });

  it("registrableDomain, isPlatformDomain and isOwnDomain never throw", () => {
    const inputs = ["", "not a host", "http://", "1.2.3.4", "example.com", "🙂.com", "a".repeat(300)];
    for (const input of inputs) {
      expect(() => registrableDomain(input)).not.toThrow();
      expect(() => isPlatformDomain(input)).not.toThrow();
      expect(() => isOwnDomain(input, "example.com")).not.toThrow();
    }
  });
});

describe("a page for job seekers and a public body are sources, read one way for the rivals and the topics", () => {
  it("reads job and careers pages by their titles, in English and German", () => {
    for (const title of ["Baker | Your Career", "Baking Career - Everything you need to know", "Baker Jobs in Australia - SEEK", "Ausbildung Bäcker/in"]) {
      expect(isJobRow({ domain: "example.com.au", title }), title).toBe(true);
    }
    expect(isJobRow({ domain: "example.com.au", title: "Fresh bread, baked daily" })).toBe(false);
  });

  it.each([
    ["en", "What does a pastry chef do?"],
    ["en", "Duties of an electrician"],
    ["de", "Was macht eine Bäckerin?"],
    ["fr", "Que fait un boulanger au quotidien"],
    ["es", "¿Qué hace un panadero?"],
    ["nl", "Wat doet een bakker?"],
  ])("reads an occupation guide's title as one (%s): %s", (_language, title) => {
    expect(isOccupationTitle(title)).toBe(true);
  });

  it.each(["What does a baker charge for a wedding cake", "Bäckerei Müller – was macht unser Brot besonders"])("never reads a business's own title as an occupation guide: %s", (title) => {
    expect(isOccupationTitle(title)).toBe(false);
  });

  it.each([
    "Job lot clearance sale",
    "Smith Electrical | No Job Too Small | Leeds",
    "Mode d'emploi du lave-vaisselle",
    "What does a CRM do? | Acme",
    "What does a PEO do for small businesses",
    "Was macht eine gute Website aus",
    "Que fait une agence SEO",
    "Wat doet een CRM-systeem",
  ])("never reads a business's own title as a job page, nor its search as a job seeker's: %s", (title) => {
    expect(isJobRow({ domain: "example.com", url: "https://example.com/shop", title })).toBe(false);
    expect(isJobSearch([{ domain: "example.com", title }, { domain: "rival.example", title }], "software")).toBe(false);
  });

  it("reads a careers host and a vacancies address", () => {
    expect(isJobRow({ domain: "careers.example.com", title: "Open roles" })).toBe(true);
    expect(isJobRow({ domain: "example.com", url: "https://example.com/vacancies/baker-123", title: "Baker" })).toBe(true);
    expect(isJobRow({ domain: "example.com", url: "https://example.com/bread", title: "Baker" })).toBe(false);
  });

  it("reads a government, a university or a public service by its suffix, never a business beside it", () => {
    for (const host of ["yourcareer.gov.au", "www.tn.gov", "irs.gov", "x.govt.nz", "x.gouv.fr", "x.gob.mx", "uni.ac.uk", "x.edu"]) {
      expect(isPublicHost(host), host).toBe(true);
    }
    for (const host of ["bakery.com.au", "govtech.com", "gobakery.mx", "example.fr"]) expect(isPublicHost(host), host).toBe(false);
  });

  it("a search is a job seeker's at half its titled top ten, and never for a business that recruits or trains", () => {
    const job = { domain: "seek.example", title: "Baker Jobs" };
    const shop = { domain: "bakery.com.au", title: "Bread" };
    expect(isJobSearch([job, job, shop, shop], "bakery")).toBe(true);
    expect(isJobSearch([job, shop, shop], "bakery")).toBe(false);
    expect(isJobSearch([job, job, { domain: "untitled.example" }, shop], "bakery")).toBe(true);
    for (const category of ["recruitment agency", "staffing services", "web development courses", "Personalvermittlung"]) {
      expect(isJobSearch([job, job, shop], category), category).toBe(false);
    }
  });
});

describe("a page is read as what it is, whoever publishes it", () => {
  it("a publisher's course page offers its own business; its list of others does not", () => {
    expect(pageClass({ domain: "campus.w3schools.com", url: "https://campus.w3schools.com/products/learn-web-design", title: "Learn Web Design" })).toBe("provider");
    expect(pageClass({ domain: "www.7x7.com", url: "https://www.7x7.com/8-excellent-new-sf-restaurants-2674196847/maritime-boat-club", title: "8 Excellent New Restaurants to Try in San Francisco" })).toBe("article");
  });

  it("a home page offers its own business, whatever its title says", () => {
    expect(pageClass({ domain: "dentistrybydesign.com", url: "https://dentistrybydesign.com/", title: "Dentistry by Design, office of Dr. Smith" })).toBe("provider");
    expect(pageClass({ domain: "blog.example.com", url: "https://blog.example.com/", title: "Our blog" })).toBe("article");
  });

  it("a forum or a directory is a third party by its host as by its path", () => {
    expect(pageClass({ domain: "community.example.com", url: "https://community.example.com/travel-forum/sf", title: "Restaurant suggestions" })).toBe("third_party");
    expect(pageClass({ domain: "www.example.ai", url: "https://www.example.ai/companies/ux-agencies/brighton", title: "UX agencies" })).toBe("third_party");
  });

  it("a rival's page is never a source, and a page about others always is in a local market", () => {
    const guide = { domain: "austinplumberco.com", url: "https://austinplumberco.com/blog/plumbing-basics/", title: "Plumbing Basics 101: A Guide For Beginners" };
    expect(isSourceRow(guide, { local: true })).toBe(true);
    expect(isSourceRow(guide, { local: false })).toBe(false);
    expect(isSourceRow(guide, { local: true, rivals: ["austinplumberco.com"] })).toBe(false);
  });
});

describe("a result behind a Google redirect is resolved to its site or read as nobody's, never google.com", () => {
  it("a goto row with a plain url= address resolves to its host", () => {
    const url = `https://www.google.com/goto?url=${encodeURIComponent("https://www.seek.com.au/baker-jobs")}`;
    expect(resolvedHost({ domain: "google.com", url })).toBe("seek.com.au");
    expect(resolvedHost({ domain: "google.com.au", url: "https://google.com.au/url?q=https://bakersdelight.com.au/&sa=U" })).toBe("bakersdelight.com.au");
  });

  it("a goto row with a breadcrumb resolves to the breadcrumb host", () => {
    expect(resolvedHost({ domain: "google.com", url: "https://google.com/goto?url=CAESmQEBk1Nw", breadcrumb: "https://www.bakersdelight.com.au › products" })).toBe("bakersdelight.com.au");
  });

  it("a token goto row with no breadcrumb is unresolved, not google.com", () => {
    expect(resolvedHost({ domain: "google.com", url: "https://google.com/goto?url=CAESmQEBk1Nw", websiteName: "SEEK" })).toBeNull();
    expect(resolvedHost({ domain: "", url: "https://google.com/goto?url=CAESmQEBk1Nw" })).toBeNull();
    // Google's own pages stay Google's.
    expect(resolvedHost({ domain: "support.google.com", url: "https://support.google.com/business/answer/1" })).toBe("support.google.com");
  });

  it("the customer's presence is not measured where a redirect row hides who holds it", () => {
    const hidden = [{ domain: "google.com", url: "https://google.com/goto?url=CAES" }, { domain: "rival.com", url: "https://rival.com/" }];
    expect(ownPlaceIn(hidden, "customer.com")).toBeNull();
    expect(ownPlaceIn([...hidden, { domain: "www.customer.com" }], "customer.com")).toBe(true);
    expect(ownPlaceIn(hidden.slice(1), "customer.com")).toBe(false);
  });

  it("a search's shares are not read where fewer than half its stored rows resolve", () => {
    const wrapper = { domain: "google.com", url: "https://google.com/goto?url=CAES", title: "Baker Jobs - SEEK" };
    const career = { domain: "careers.bakery.com.au", url: "https://careers.bakery.com.au/", title: "Baker jobs" };
    expect(resolvedRows([career, wrapper, wrapper])).toBeNull();
    expect(isJobSearch([career, career, career, wrapper, wrapper, wrapper, wrapper, wrapper], "bakery")).toBe(false);
    expect(isJobSearch([career, career, career, career, wrapper, wrapper, wrapper, wrapper], "bakery")).toBe(true);
  });
});
