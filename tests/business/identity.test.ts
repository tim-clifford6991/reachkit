// Who runs a site, as its structured data says. Type names as `parse.ts`
// keeps them, from the customer panel: a local trade, a SaaS, a creator and
// a theme that labels only its breadcrumbs.
import { describe, expect, it } from "vitest";
import { identityOf, typeWords } from "@/lib/business/identity";

describe("who the labels say runs the site", () => {
  it("a local plumber's home page is a local business, named by its most specific type", () => {
    expect(identityOf(["website", "plumber", "localbusiness"])).toEqual({ kind: "local_business", type: "Plumber" });
  });

  it("a SaaS home page is an organization", () => {
    expect(identityOf(["website", "organization"])).toEqual({ kind: "organization", type: "Organization" });
  });

  it("a creator who labels only a person is a person", () => {
    expect(identityOf(["person"])).toEqual({ kind: "person", type: "Person" });
  });

  it("labels that name no one say nothing about who runs the site", () => {
    expect(identityOf(["breadcrumblist"])).toBeNull();
    expect(identityOf(["website", "imageobject"])).toBeNull();
    expect(identityOf(["webpage", "article", "faqpage", "product"])).toBeNull();
    expect(identityOf([])).toBeNull();
  });

  it("reads a type in any case, and as a schema.org address", () => {
    expect(identityOf(["https://schema.org/Dentist"])).toEqual({ kind: "local_business", type: "Dentist" });
    expect(identityOf(["http://schema.org/Corporation/"])).toEqual({ kind: "organization", type: "Corporation" });
    expect(identityOf(["schema:NGO"])).toEqual({ kind: "organization", type: "NGO" });
  });

  it("a business outranks the person who wrote its page", () => {
    expect(identityOf(["person", "organization"])?.kind).toBe("organization");
    expect(identityOf(["organization", "localbusiness"])?.kind).toBe("local_business");
  });
});

describe("a type as a reader says it", () => {
  it("splits words and keeps an abbreviation whole", () => {
    expect(typeWords("Plumber")).toBe("a plumber");
    expect(typeWords("LocalBusiness")).toBe("a local business");
    expect(typeWords("Organization")).toBe("an organization");
    expect(typeWords("NGO")).toBe("an NGO");
    expect(typeWords("HVACBusiness")).toBe("an HVAC business");
  });
});
