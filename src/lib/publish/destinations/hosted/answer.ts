// BUILD §9 — the hosted edge's one read before its cache: a host's destination, site, owner and addresses together.
import { publishDb } from "../../db";
import { addressOf, type AddressRow, type HostedAddress } from "./moved";
import type { HostedSite } from "./store";

/** A publication as `addressOf` reads it, and the columns that read selects. */
export type AddressJoin = {
  id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  merged_into: string | null;
  drafts: { opportunities: { family: string | null; target_ref: string | null } | null } | null;
};
export const ADDRESS_COLUMNS = "id, live_url, published_at, unpublished_at, merged_into, drafts(opportunities(family, target_ref))";

export function toAddressRow(row: AddressJoin): AddressRow {
  const opportunity = row.drafts?.opportunities ?? null;
  return {
    id: row.id,
    live_url: row.live_url,
    published_at: row.published_at,
    unpublished_at: row.unpublished_at,
    updates: opportunity?.family === "improve" ? (opportunity.target_ref ?? null) : null,
    merged_into: row.merged_into ?? null,
  };
}

/** What the edge answers a host from, by the same match as `hostedSiteForHostname`: only a live host serves. */
export interface HostedAnswerRow extends HostedSite {
  /** The owner's deletion and the retention end, as `servingStateOf` reads them; `null` where the owner is gone. */
  serving: { owner_deleted_at: string | null; hosted_serving_ends_at: string | null } | null;
  /** The state of one slug on this site, by `addressOf`. */
  addressAt(slug: string): HostedAddress;
}

/** The destination, its site, the owner's deletion and the hosted publications, in one embedded select, because the
 *  edge asks all of them before its cache on every request. `null` where no live destination holds the host, so a host
 *  still waiting for DNS has not proved it is this site's and serves nothing; a failed read throws. */
export async function hostedAnswerRow(host: string): Promise<HostedAnswerRow | null> {
  const name = host.trim().toLowerCase();
  if (name === "") return null;
  type Site = {
    domain: string | null;
    hosted_serving_ends_at: string | null;
    users: { deleted_at: string | null } | null;
    publications: (AddressJoin & { destination: string })[] | null;
  };
  const { data, error } = await publishDb()
    .from<{ site_id: string; sites: Site | null }>("destinations")
    .select(`site_id, sites!inner(domain, hosted_serving_ends_at, users(deleted_at), publications(destination, ${ADDRESS_COLUMNS}))`)
    .eq("hostname", name)
    .eq("kind", "hosted")
    .eq("hostname_state", "live")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) throw new Error("hosted answer read failed");
  const row = data[0];
  const site = row?.sites ?? null;
  if (row === undefined || site === null || site.domain === null || site.domain.trim() === "") return null;
  const rows = (site.publications ?? []).filter((publication) => publication.destination === "hosted").map(toAddressRow);
  return {
    siteId: row.site_id,
    domain: site.domain,
    host: name,
    serving: site.users === null ? null : { owner_deleted_at: site.users.deleted_at ?? null, hosted_serving_ends_at: site.hosted_serving_ends_at ?? null },
    addressAt: (slug) => addressOf(rows, slug),
  };
}
