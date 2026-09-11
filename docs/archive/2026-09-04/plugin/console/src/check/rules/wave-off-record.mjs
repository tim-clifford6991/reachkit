// ---- wave-off-record (front-matter grammar only) -------------------------

export default {
  id: "wave-off-record",
  text: "a work order and registry/waves.md disagree about its wave",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // registry/waves.md and a work order's own `wave:` are two declarations of
    // the same fact, and the whole point of a derived index is that the two
    // can disagree — this rule is the check. Four shapes: (a) a WO's `wave:`
    // names a wave the file doesn't have; (b) an *open* wave row names a WO id
    // with no work-order node behind it; (c) an *open* wave row names a WO
    // whose own `wave:` says something else (including nothing at all —
    // absent counts as differing); (d) more than one row is `open` at once.
    // (b) and (c) run only over `open` rows — a closed row is history, and a
    // work order's `wave:` is never expected to still match a wave that has
    // since closed. Can't judge anything with an empty record, so an absent or
    // empty registry/waves.md is `notRun` with a notice, the same posture
    // requirement-off-journey takes for a corpus with no journeys yet.
    if (cfg.grammar === "front-matter") {
      const waves = graph.waves || { list: [], present: false };
      if (!waves.list.length) {
        notices.push(
          waves.present
            ? "registry/waves.md has no wave rows yet — wave-off-record cannot run; /wave propose writes the first wave."
            : "No registry/waves.md — wave-off-record cannot run; /wave propose writes the first wave."
        );
        notRun.push("wave-off-record");
      } else {
        const waveIds = new Set(waves.list.map((w) => w.id));
        for (const n of graph.nodes) {
          if (n.y !== "work-order" || !n.m?.Wave) continue;
          if (!waveIds.has(n.m.Wave)) {
            add("wave-off-record",
              `${n.i}: its wave "${n.m.Wave}" is not in registry/waves.md`,
              `registry/waves.md declares: ${[...waveIds].join(", ") || "(no waves)"}`,
              n.i);
          }
        }
        const openRows = waves.list.filter((row) => row.status === "open");
        for (const row of openRows) {
          for (const woId of row.wos) {
            const woNode = byId.get(woId);
            if (!woNode || woNode.y !== "work-order") {
              add("wave-off-record",
                `${row.id} names ${woId}, which has no work-order artifact`,
                `registry/waves.md's ${row.id} row lists ${woId} — no work-order node exists with that id`,
                woId);
              continue;
            }
            const actual = woNode.m?.Wave ?? null;
            if (actual !== row.id) {
              add("wave-off-record",
                `${woId}: registry/waves.md's ${row.id} row names it, but its own wave: says ${actual ? `"${actual}"` : "nothing"}`,
                `the record and the artifact disagree — fix one to match the other`,
                woId);
            }
          }
        }
        if (openRows.length > 1) {
          add("wave-off-record",
            `registry/waves.md has ${openRows.length} open waves (${openRows.map((row) => row.id).join(", ")}) — close one`,
            `only one wave should be open at a time — close the others before opening the next`,
            openRows.map((row) => row.id).join(", "));
        }
      }
    }
  },
};
