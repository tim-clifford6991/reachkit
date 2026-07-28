"use client";
/**
 * WS1 — the Competitors PLACEMENT gap-map (R-6.7). Columns = you + rivals, rows =
 * the 5 quality placement groups, colour = how many quality sites in that channel
 * LINK to the entity (backlink/placement presence) — NOT measured discovery or
 * traffic (a backlink proves a link exists, not that anyone traverses it). A
 * RED/absent cell in the "you" column where a rival has placements is the honest
 * "you're not listed here" signal. Column headers ARE the competitor selector.
 *
 * Laid out column-major (a flex column per entity) so the SELECTED entity gets a
 * single surround around its whole column — header + all its cells — rather than
 * an outline drawn around each individual cell.
 */
import { Eyebrow } from "@/components/app/intel/kit";

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

const HEADER_H = 30;
const CELL_H = 24;
const LABEL_W = 120;

export function CompetitorGapMap(props: {
  entities: { domain: string; isSubject?: boolean }[];
  channelStrength: Record<string, Record<string, string>>;
  selected: string;
  onSelect: (domain: string) => void;
}) {
  const { entities, channelStrength, selected, onSelect } = props;
  return (
    <div>
      <Eyebrow>Placement gap — where rivals are listed and you&apos;re not · click a rival to focus</Eyebrow>
      <div style={{ display: "flex", gap: 4, marginTop: 8, overflowX: "auto" }}>
        {/* Row-label column — a transparent 2px border + 2px padding mirrors the
            entity columns' box model so the label cells line up with the data cells. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto", width: LABEL_W, border: "2px solid transparent", padding: 2 }}>
          <div style={{ height: HEADER_H }} />
          {GROUPS.map((g) => (
            <div key={g.key} style={{ height: CELL_H, display: "flex", alignItems: "center", fontSize: 11.5, color: "var(--c-muted)" }}>
              {g.label}
            </div>
          ))}
        </div>
        {/* One flex column per entity — the whole column carries the selection
            border, so the surround wraps header + every cell as a single box. */}
        {entities.map((e) => {
          const isSel = e.domain === selected;
          return (
            <div
              key={e.domain}
              style={{
                display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0%", minWidth: 64,
                border: "2px solid " + (isSel ? "var(--c-action)" : "transparent"),
                borderRadius: 8, padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(e.domain)}
                aria-pressed={isSel}
                title={e.isSubject ? "You" : e.domain}
                style={{
                  height: HEADER_H, width: "100%", fontFamily: "Plus Jakarta Sans", fontSize: 11.5,
                  fontWeight: isSel ? 700 : 600, borderRadius: 6, cursor: "pointer", textAlign: "center", border: "none",
                  color: isSel ? "#fff" : e.isSubject ? "var(--c-action)" : "var(--c-muted)",
                  background: isSel ? "var(--c-action)" : "transparent",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {e.isSubject ? "You" : e.domain.replace(/^www\./, "")}
              </button>
              {GROUPS.map((g) => {
                const bucket = channelStrength[e.domain]?.[g.key] ?? "absent";
                const c = CELL[bucket] ?? CELL.absent!;
                return (
                  <div
                    key={g.key}
                    title={`${e.isSubject ? "You" : e.domain} · ${g.label}: ${c.txt} placement presence (quality sites in this channel that link to ${e.isSubject ? "you" : "them"})`}
                    style={{
                      height: CELL_H, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9.5, color: c.fg, background: c.bg,
                    }}
                  >
                    {c.txt}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--c-faint)", marginTop: 6 }}>
        Red in <b>your</b> column where a rival has placements = the highest-value channels to get listed in.
      </p>
    </div>
  );
}
