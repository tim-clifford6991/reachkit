"use client";

/**
 * The scope. Everything a variant is, is on this one element.
 *
 * There is no variant prop on any component below this div, and no
 * component in src/components/ knows that variants exist. That is the
 * claim the whole exploration rests on and it is checkable by reading the
 * imports: a variant screen imports the SAME registered components the
 * walkthrough imports, and the only difference between two variants is
 * seven data-* attributes here.
 */
import type { ReactNode } from "react";
import { AXES, type Tuple, heldAxes, movedAxes, proposedSpend } from "./axes";

export function VariantScope({ tuple, children }: { tuple: Tuple; children: ReactNode }) {
  return (
    <div
      className="v"
      data-density={tuple.density}
      data-separation={tuple.separation}
      data-radius={tuple.radius}
      data-type={tuple.type}
      data-colour={tuple.colour}
      data-chrome={tuple.chrome}
      data-figure={tuple.figure}
    >
      {children}
    </div>
  );
}

/**
 * Every variant screen carries this. Two facts it must state and a third
 * the exploration adds: what it is not (a signed anything), which axes it
 * moves, and which axes it deliberately leaves at the baseline — because a
 * variant you cannot take one piece of is not a variant you can compose
 * from.
 */
export function VariantBanner({ id, intent, tuple }: { id: string; intent: string; tuple: Tuple }) {
  const moved = movedAxes(tuple);
  const held = heldAxes(tuple);
  const proposed = proposedSpend(tuple);
  const title = (axisId: string) => AXES.find((a) => a.id === axisId)?.title ?? axisId;

  return (
    <div className="pv-stop" style={{ marginBottom: "var(--s-5)" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Variant exploration — a token set applied to an unchanged screen. Not a signed preview of
        any work order, and no components.md row moves because of it.
      </p>
      <p style={{ margin: "var(--s-2) 0 0" }} className="pv-mono">
        variant: {id} · {moved.length === 0 ? "moves nothing — this is the baseline" : `moves ${moved.length} of 7 axes`}
      </p>
      <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
        moved: {moved.length ? moved.map((a) => `${title(a)} → ${tuple[a]}`).join(" · ") : "—"}
      </p>
      <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
        held at baseline: {held.length ? held.map(title).join(" · ") : "—"}
      </p>
      {proposed.length > 0 ? (
        <p style={{ margin: "var(--s-2) 0 0" }}>
          <span className="pv-flag">proposed · {proposed.join(" · ")}</span>{" "}
          <span className="pv-mono">not registered — needs your word before any UI code may name it</span>
        </p>
      ) : null}
      <p style={{ margin: "var(--s-2) 0 0" }} className="pv-mono">
        {intent}
      </p>
    </div>
  );
}
