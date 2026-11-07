// SPEC §5 — the web person's mail: the record as the provider's form asks for it, that provider's steps, and no way
// into the buyer's account; the proxy line only where the DNS is at Cloudflare.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";
applyEnvFixture();
const { composeMail } = await import("../../../../src/lib/mail/send");
const { buildWebPersonMail } = await import("../../../../src/lib/mail/templates/web-person");
const { guideView } = await import("../../../../src/lib/publish/destinations/hosted/dns-guide");
const { COPY, copy } = await import("../../../../src/lib/presentation/copy");
type DnsWhere = import("../../../../src/lib/publish/destinations/hosted/dns-provider").DnsWhere;

const record = { type: "CNAME", name: "help.acme.co.uk", value: "hosted.edge.example" };
const mailAt = (where: DnsWhere) =>
  composeMail({ kind: "web-person", ...buildWebPersonMail({ domain: "acme.co.uk", host: record.name, view: guideView({ record, where, zone: "acme.co.uk" }) }) });

describe("the web person's mail", () => {
  it("at Cloudflare: its field labels with the label alone as the name, its steps, and the proxy line", async () => {
    const { subject, text, html } = await mailAt({ kind: "provider", provider: "Cloudflare", guide: "cloudflare" });
    expect(subject).toBe(copy("mail.webPerson.subject", { domain: "acme.co.uk" }));
    expect(text).toContain(`${COPY["setup.destination.guide.field.name"]}: help\n`);
    expect(text).toContain(`${COPY["setup.destination.guide.field.target"]}: hosted.edge.example`);
    expect(text).toContain(`${COPY["setup.destination.guide.field.proxy-status"]}: ${COPY["setup.destination.guide.value.dns-only"]}`);
    expect(text).toContain(copy("setup.destination.guide.cloudflare.3", { name: "help", zone: "acme.co.uk" }));
    expect(text).toContain(COPY["setup.destination.dnsProxy"]);
    expect(html).not.toMatch(/href="https?:\/\/[^"]*\/(app|setup|signin)/);
  });

  it("anywhere else: the generic steps, the nameserver named as itself, and no proxy line", async () => {
    const { text } = await mailAt({ kind: "nameserver", nameserver: "ns1.tiny-host.example" });
    expect(text).toContain(copy("setup.destination.dnsNameserver", { nameserver: "ns1.tiny-host.example" }));
    expect(text).toContain(copy("setup.destination.guide.generic.2", { name: "help", host: record.name }));
    expect(text).not.toContain(COPY["setup.destination.dnsProxy"]);
  });
});
