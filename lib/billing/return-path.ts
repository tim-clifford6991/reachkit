/**
 * Sanitize a caller-supplied "return here after Stripe" path.
 *
 * Stripe checkout `cancel_url` and portal `return_url` are where the user lands
 * when they hit Back / Return-to-merchant. We let the initiating surface pass
 * its own path (e.g. Settings sends `/app/settings`) so the user returns to
 * where they were — never a hard-coded `/app/billing` they didn't come from.
 *
 * The value crosses a trust boundary (it's echoed into a redirect URL), so it's
 * validated to a same-origin, in-app relative path: must start with a single
 * "/", stay under `/app`, and contain no scheme, host, or protocol-relative
 * "//" that could turn into an open redirect. Anything else → the safe default.
 */
export function safeReturnPath(raw: unknown, fallback = "/app"): string {
  if (typeof raw !== "string") return fallback;
  const path = raw.trim();
  // Must be a relative path rooted at "/", but not protocol-relative ("//host")
  // or a backslash trick ("/\host").
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  // Keep it inside the authenticated app. `/app` exactly or any `/app/...` path.
  if (path !== "/app" && !path.startsWith("/app/") && !path.startsWith("/app?")) {
    return fallback;
  }
  // No control chars or whitespace that could break out of the URL.
  if (/[\s\x00-\x1f]/.test(path)) return fallback;
  return path;
}
