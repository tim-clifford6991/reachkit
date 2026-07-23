/**
 * Sanitize a caller-supplied post-auth redirect target (`next`).
 *
 * The value crosses a trust boundary (echoed into NextResponse.redirect and the
 * magic-link emailRedirectTo), so it must be a genuine same-origin RELATIVE path.
 *
 * raw.startsWith("/") alone is NOT enough: a protocol-relative //evil.com (and the
 * backslash variant) also starts with "/", and new URL("//evil.com", origin)
 * resolves to https://evil.com per WHATWG — an open redirect (CWE-601) usable for
 * phishing from our own domain. Reject those explicitly. Mirrors
 * lib/billing/return-path.ts::safeReturnPath, minus the /app-only restriction.
 */
export function safeRelativePath(raw: unknown, fallback = "/app"): string {
  if (typeof raw !== "string") return fallback;
  const path = raw.trim();
  // Rooted at a single "/", never protocol-relative ("//host") or the backslash
  // trick ("/\\host") that browsers normalise to "//".
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  // No whitespace/control chars that could break out of the URL context.
  if (/[\s\u0000-\u001f]/.test(path)) return fallback;
  return path;
}
