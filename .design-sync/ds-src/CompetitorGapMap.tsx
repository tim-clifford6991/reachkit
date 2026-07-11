/* @mirrors components/app/intel/competitor-gap-map.tsx */
import * as React from "react";

/**
 * CompetitorGapMap — WS1 Competitors gap-map. Rows = the 5 quality channel
 * groups, columns = you + rivals, colour = strength; a RED/absent cell in the
 * "you" column where a rival is strong is the honest "you're not here"
 * signal. Column headers double as the competitor selector (click to focus).
 */
const GROUPS: { key: string; label: string }[] = [
  { key: "reviews", label: "Reviews & launch" },
  { key: "directories", label: "Directories" },
  { key: "community", label: "Community" },
  { key: "media", label: "Media & blogs" },
  { key: "partners", label: "Partners" },
];

const CELL: Record<string, { bg: string; fg: string; txt: string }> = {
  hi: { bg: "var(--c-band-findable)", fg: "#fff", txt: "Strong" },
  med: { bg: "var(--c-band-fair)", fg: "#1b1b1b", txt: "Some" },
  lo: { bg: "var(--c-soft)", fg: "var(--c-muted)", txt: "Thin" },
  absent: { bg: "var(--c-band-invisible)", fg: "#fff", txt: "None" },
};

export interface CompetitorGapMapProps {
  entities: { domain: string; isSubject?: boolean }[];
  channelStrength: Record<string, Record<string, string>>;
  selected: string;
  onSelect?: (domain: string) => void;
}

export function CompetitorGapMap({ entities, channelStrength, selected, onSelect }: CompetitorGapMapProps) {
  const cols = `120px repeat(${entities.length}, minmax(64px, 1fr))`;
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <div style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        Gap map — where you&apos;re absent · click a rival to focus
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginTop: 8 }}>
        <span />
        {entities.map((e) => (
          <button
            key={e.domain}
            type="button"
            onClick={() => onSelect?.(e.domain)}
            aria-pressed={e.domain === selected}
            title={e.isSubject ? "You" : e.domain}
            style={{
              fontFamily: "var(--font-display)", fontSize: 11.5, fontWeight: e.domain === selected ? 700 : 600,
              padding: "6px 4px", borderRadius: "8px 8px 0 0", cursor: "pointer", textAlign: "center",
              border: "1px solid " + (e.domain === selected ? "var(--c-action)" : "transparent"), borderBottom: "none",
              color: e.domain === selected ? "#fff" : e.isSubject ? "var(--c-action)" : "var(--c-muted)",
              background: e.domain === selected ? "var(--c-action)" : "transparent",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {e.isSubject ? "You" : e.domain.replace(/^www\./, "")}
          </button>
        ))}
        {GROUPS.map((g) => (
          <React.Fragment key={g.key}>
            <span style={{ fontSize: 11.5, color: "var(--c-muted)", display: "flex", alignItems: "center" }}>{g.label}</span>
            {entities.map((e) => {
              const bucket = channelStrength[e.domain]?.[g.key] ?? "absent";
              const c = CELL[bucket] ?? CELL.absent!;
              return (
                <div
                  key={e.domain}
                  title={`${e.isSubject ? "You" : e.domain} · ${g.label}: ${c.txt}`}
                  style={{
                    height: 24, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9.5, color: c.fg, background: c.bg,
                    outline: e.domain === selected ? "2px solid var(--c-action)" : "none", outlineOffset: -2,
                  }}
                >
                  {c.txt}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--c-faint)", marginTop: 6 }}>
        Red in <b>your</b> column where a rival is strong = the highest-value channels to enter.
      </p>
    </div>
  );
}
