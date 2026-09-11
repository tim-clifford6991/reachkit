import type { ReactNode } from "react";

/**
 * Sheet furniture — the reviewer-facing annotation around a specimen.
 * Everything in this file is drawn in --pv-* and is never a product surface.
 */

export function SheetHead({
  title,
  carries,
  children,
}: {
  title: string;
  carries: string;
  children?: ReactNode;
}) {
  return (
    <header className="stack-2" style={{ marginBottom: "var(--s-5)" }}>
      <h1 className="pv-h1">{title}</h1>
      <p className="pv-mono">{carries}</p>
      {children}
    </header>
  );
}

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="pv-h2" id={`s${n}`}>
        {n} · {title}
      </h2>
      {children}
    </section>
  );
}

export function Sub({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h3 className="pv-h3">{title}</h3>
      {children}
    </>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="pv-p">{children}</p>;
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="pv-note">{children}</div>;
}

export function Stop({ children }: { children: ReactNode }) {
  return <div className="pv-stop">{children}</div>;
}

export function Flag({ children }: { children: ReactNode }) {
  return <span className="pv-flag">{children}</span>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="pv-mono">{children}</code>;
}

export function Pre({ children }: { children: string }) {
  return <pre className="pv-pre">{children}</pre>;
}

/**
 * A specimen stage. Its inner surface is the product: `.rk` puts the page
 * background and the product type scale on, so what is inside the frame is
 * exactly what a customer would see and what is outside it never is.
 */
export function Stage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pv-stage">
      <p className="pv-stage-label">{label}</p>
      {/* `.rk-main`'s padding, so a specimen has the same buffer at its
          edges on a phone that it has on a desktop — the owner's rule
          applied to the frame the specimen sits in, not only to the
          specimen. */}
      <div className="rk rk-main" style={{ borderRadius: "var(--r-box)" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A specification table is one of the few shapes that genuinely cannot
 * reflow — its columns mean something. It scrolls inside its own wrap, the
 * way the registered `Table` does, rather than pushing the document wider
 * than the viewport. The wrap is part of this component, not the caller's.
 */
export function ScrollX({ children }: { children: ReactNode }) {
  return <div className="scroll-x">{children}</div>;
}

export function SpecTable({
  head,
  rows,
}: {
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <ScrollX>
      <table className="pv-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "m" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}
