// ---- stale-blueprint (code layer only) ----------------------------------

export default {
  id: "stale-blueprint",
  text: "a blueprint whose code moved after the blueprint did",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // 8090's pitch turns on one question: which document is the source of
    // truth once code and docs disagree? Here that question is mechanical —
    // for a blueprint anchored to real files, compare the newest commit
    // touching those files against the newest commit touching the blueprint's
    // own file. If the code moved more recently and the blueprint didn't move
    // with it, the blueprint is not lying yet, but it is aging in public.
    if (graph.code?.present) {
      // docsPrefix is `relative(repo.root, docsRoot)` (extract/index.mjs). An
      // empty string means the docs root IS the repo root — joining it with
      // "/" would build "/node.f", which never matches a tracked path. And a
      // prefix starting with ".." means docsRoot sits outside the repository
      // entirely — no blueprint file path constructed from it can ever match a
      // commit's file list, so the rule would silently never fire rather than
      // reporting anything wrong.
      if (graph.code.docsPrefix.startsWith("..")) {
        notices.push(
          `docsRoot sits outside the repository at ${cfg.code.root} — stale-blueprint cannot match blueprint files to commits.`
        );
      }
      // A commit that names a work order implementing THIS blueprint is the
      // blueprint being BUILT, not the code drifting from it. The first live
      // run (2026-08-29) fired this rule three times on a fresh product whose
      // every commit was doing exactly what the blueprint ordered — only
      // unplanned motion ages a blueprint, so implementing commits are
      // excluded from the comparison below.
      const implementsByBp = new Map();
      for (const [from, to, rel] of graph.edges) {
        if (rel !== "implements") continue;
        if (!implementsByBp.has(to)) implementsByBp.set(to, new Set());
        implementsByBp.get(to).add(from);
      }
      for (const [bpId, anchor] of Object.entries(graph.code.anchors)) {
        if (!anchor.files.length) continue;
        const node = byId.get(bpId);
        if (!node) continue;
        const ownFile = graph.code.docsPrefix ? `${graph.code.docsPrefix}/${node.f}` : node.f;
        const anchoredSet = new Set(anchor.files);
        const implementingWos = implementsByBp.get(bpId);
        // Commits are newest-first, so the first match is the latest one.
        const bpCommits = graph.code.commits.filter((c) => c.files.includes(ownFile));
        const codeCommits = graph.code.commits.filter((c) =>
          c.files.some((f) => anchoredSet.has(f)) && !c.files.includes(ownFile) &&
          !(implementingWos && c.wo.some((w) => implementingWos.has(w))));
        if (!bpCommits.length || !codeCommits.length) continue;
        const bpLatest = bpCommits[0];
        const codeLatest = codeCommits[0];
        if (codeLatest.d <= bpLatest.d) continue;
        const since = codeCommits.filter((c) => c.d > bpLatest.d);
        add("stale-blueprint",
          `${bpId}: its code changed after the blueprint did`,
          `${since.length} commit(s) under ${anchor.globs.join(", ")} since ${bpLatest.h} (${bpLatest.d}), ` +
          `latest ${codeLatest.h} — which is the source of truth, the code or the blueprint?`,
          bpId);
      }
    }
  },
};
