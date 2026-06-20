/**
 * ExportButton — paid CSV download of the latest report (ChannelIntel UX).
 *
 * Surfaces the already-built `GET /api/app/[id]/export` route (competitors,
 * keyword gap, demand pockets, ranked playbook). Server-rendered anchor:
 *   - paid + appId → real download link to the export route
 *   - otherwise   → a locked affordance pointing at the #unlock CTA
 */

interface ExportButtonProps {
  appId: string | null;
  unlocked: boolean;
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
      <path d="M7 1.5v7m0 0L4.5 6M7 8.5 9.5 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10.5v1A1.5 1.5 0 0 0 3.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0">
      <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ExportButton({ appId, unlocked }: ExportButtonProps) {
  const enabled = unlocked && !!appId;
  const href = enabled ? `/api/app/${appId}/export` : "#unlock";

  return (
    <a
      href={href}
      {...(enabled ? { download: "" } : {})}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors"
      style={{
        borderColor: enabled ? "var(--hairline)" : "var(--color-accent-900)",
        background: enabled ? "var(--fill-subtle)" : "var(--color-accent-subtle)",
        color: enabled ? "var(--color-fg)" : "var(--color-accent-400)",
      }}
    >
      {enabled ? <DownloadIcon /> : <LockIcon />}
      {enabled ? "Export CSV" : "Export CSV — unlock"}
    </a>
  );
}
