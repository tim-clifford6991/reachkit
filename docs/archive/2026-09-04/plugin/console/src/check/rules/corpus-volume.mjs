// ---- corpus-volume (both grammars) --------------------------------------
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { helpers } from "./_shared.mjs";

export default {
  id: "corpus-volume",
  text: "live words per approved requirement, or lines per work order, over budget",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // Rule 2.5's shadow, measured: live words (every file-shaped artifact the
    // parser walked — `_`-prefixed files, history/, registry/generated/,
    // design/ and the charter are outside "live" by construction, and the
    // notice says how many files that excluded), words per approved
    // requirement, lines per work order, work orders per approved requirement.
    // Two findings at most — one per breached budget; the lines finding names
    // the count over and the ten largest rather than one finding per order,
    // which on the second live corpus would have been fifty-two lines of noise.
    {
      const fileNodes = graph.nodes.filter((n) => typeof n.w === "number");
      const approvedReq = graph.nodes.filter((n) => kindOf(n) === "requirement" && n.s === "approved").length;
      if (!fileNodes.length) {
        notices.push("corpus-volume cannot run — no file-shaped artifact in this corpus yet.");
        notRun.push("corpus-volume");
      } else {
        const live = fileNodes.reduce((s, n) => s + n.w, 0);
        const woLines = graph.nodes
          .filter((n) => kindOf(n) === "work-order" && typeof n.l === "number")
          .map((n) => ({ id: n.i, l: n.l }));
        const sortedL = woLines.map((x) => x.l).sort((a, b) => a - b);

        // What "live" left out, by directory, so the denominator is stated
        // rather than implied. Only when the project root is known.
        let excluded = "";
        if (root) {
          const declaredDirs = new Set(cfg.types.filter((t) => t.dir).map((t) => t.dir));
          const docsRoot = join(root, cfg.docsRoot);
          const groups = new Map();
          const walk = (dir, rel, filesCount) => {
            let ents;
            try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const e of ents) {
              if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
              const r = rel ? `${rel}/${e.name}` : e.name;
              if (e.isDirectory()) {
                // A declared type directory's own files are the live nodes;
                // only its subdirectories (requirements/history/) are excluded.
                walk(join(dir, e.name), r, !(rel === "" && declaredDirs.has(e.name)));
              } else if (filesCount && e.name.endsWith(".md")) {
                // Everything under the archive counts as one group — a pivot
                // moves hundreds of files, and listing them by subdirectory
                // would drown the line that names what is live.
                const g = cfg.archive && (rel === cfg.archive || rel.startsWith(`${cfg.archive}/`)) ? cfg.archive : (rel || "docs root");
                groups.set(g, (groups.get(g) || 0) + 1);
              }
            }
          };
          walk(docsRoot, "", true);
          if (groups.size) {
            excluded = ` (excluded: ${[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([g, n]) => `${g} ${n}`).join(", ")})`;
          }
        }

        if (!approvedReq) {
          notices.push(`corpus-volume: ${fmt(live)} live words in ${plural(fileNodes.length, "file")}${excluded} · no approved requirement yet, so words per approved requirement has no denominator.`);
          notRun.push("corpus-volume");
        } else {
          const perReq = Math.round(live / approvedReq);
          const wordsCap = cfg.checks.wordsPerApprovedRequirement ?? 6000;
          const linesCap = cfg.checks.linesPerWorkOrder ?? 150;
          if (perReq > wordsCap) {
            add("corpus-volume",
              `${fmt(perReq)} live words per approved requirement (budget: ${fmt(wordsCap)}) — rule 2.5`,
              `${fmt(live)} live words / ${approvedReq} approved requirements`,
              "corpus");
          }
          const over = woLines.filter((x) => x.l > linesCap).sort((a, b) => b.l - a.l);
          if (over.length) {
            add("corpus-volume",
              `${plural(over.length, "work order")} over ${linesCap} lines (checks.linesPerWorkOrder) — rule 2.5`,
              `largest: ${over.slice(0, 10).map((x) => `${x.id} (${x.l})`).join(", ")}`,
              "work-orders");
          }
          const fo = fanout();
          notices.push(
            `corpus-volume: ${fmt(live)} live words in ${plural(fileNodes.length, "file")}${excluded} · ` +
            `${approvedReq} approved REQ · ${fmt(perReq)} words/approved REQ · ` +
            `WO lines median ${quantile(sortedL, 0.5)} / p90 ${quantile(sortedL, 0.9)} / max ${sortedL.at(-1) ?? 0} · ` +
            `${fo.perReq === null ? "—" : fo.perReq.toFixed(1)} WO/approved REQ`
          );
        }
      }
    }
  },
};
