// RFC 9116: where a security researcher reports a finding.
import { PUBLIC_ORIGIN } from "../../_chrome/canonical";

// Static, so Expires is stamped at build and every deploy renews it.
export const dynamic = "force-static";

// RFC 9116 §2.5.5 recommends an expiry less than a year away.
const LIFETIME_MS = 364 * 24 * 60 * 60 * 1000;

export function GET(request: Request): Response {
  const origin = PUBLIC_ORIGIN ?? new URL(request.url).origin;
  const body = [
    "Contact: mailto:hello@reachkit.app",
    `Expires: ${new Date(Date.now() + LIFETIME_MS).toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${new URL("/.well-known/security.txt", origin).toString()}`,
    "",
  ].join("\n");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
