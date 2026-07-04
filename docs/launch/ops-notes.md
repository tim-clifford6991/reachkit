# Ops notes

Operational settings that live OUTSIDE the repo (Vercel dashboard etc.) and
would otherwise be forgotten. Sibling of `domain-cutover.md`.

## Deployment skew protection (Vercel) — ENABLE BEFORE LAUNCH

**Symptom:** a user with an old tab open clicks something right after a new
deploy and gets "We hit an unexpected error" — the old build requests a chunk /
dynamic import / RSC payload that the new deploy renamed (prod telemetry
2026-07-04: 0 server errors in 24h, all such reports were skew).

**Fix (platform level):** enable **Skew Protection** in the Vercel dashboard —
*Project Settings → Advanced → Skew Protection* (Pro plan feature). Vercel then
pins each client to the deployment that served it (it injects the deployment ID
into asset/data requests automatically), so old tabs keep resolving against
their own build for the configured max age.

Notes:

- This is a **dashboard-only** setting on Vercel — there is nothing to commit.
  Next.js does have a `deploymentId` option in `next.config.ts`, but that is the
  **self-hosted** skew mechanism; on Vercel the platform manages deployment IDs
  itself once the toggle is on, so we intentionally did NOT set it.
- **Client-side backstop (in the repo):** `app/error.tsx` auto-reloads ONCE per
  session (sessionStorage flag `rk-skew-reloaded`) when the caught error matches
  a stale-chunk signature (`ChunkLoadError`, failed dynamic import, RSC payload
  fetch failure). This heals users who hit skew before/without the dashboard
  setting, without masking real errors or looping.
- After enabling, verify by deploying twice and clicking around an old tab.
