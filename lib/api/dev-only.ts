/**
 * Guard for local-dev-only API routes (the `/api/test-*` endpoints). These are
 * kept for manual pipeline testing but must never be reachable in production,
 * where they would run unauthenticated and trigger metered DataForSEO/LLM spend.
 *
 * Usage at the top of a route handler:
 *   const blocked = blockInProd();
 *   if (blocked) return blocked;
 */
export function blockInProd(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  return null;
}
