/**
 * Owner gate for internal-only surfaces (e.g. the /app/diagnostics transparency
 * page, which exposes per-stage LLM cost we don't want to show customers).
 *
 * Allowlist via REACHKIT_OWNER_EMAILS (comma-separated). When UNSET, owner tools
 * are available in development only and NEVER in production — so a missing env var
 * fails closed in prod rather than exposing internals to every signed-in user.
 */

function ownerEmails(): string[] {
  return (process.env.REACHKIT_OWNER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = ownerEmails();
  if (list.length === 0) return process.env.NODE_ENV !== "production";
  return list.includes(email.toLowerCase());
}
