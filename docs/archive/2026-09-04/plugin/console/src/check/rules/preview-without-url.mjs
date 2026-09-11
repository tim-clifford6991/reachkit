// ---- preview-without-url (front-matter grammar only) -------------------

export default {
  id: "preview-without-url",
  text: "a ui: yes work order in implementation whose log records no published preview",
  run(ctx) {
    const { graph, cfg, add } = ctx;
    // Rule 7.3, 0.13.0: a preview is two things — the sheet file in the
    // corpus, which is the record, and the published page, which is the
    // owner's door. The sheet's existence on disk was never checkable from
    // here (`design/` is not an artifact directory and no type declares
    // it); the page's URL is, because the design-guardian logs it in the
    // work order's own `## Log`:
    //
    //     - <date> preview — design-guardian — v<n> — <url>
    //
    // So this rule asks the answerable half of the gate: a `ui: yes` work
    // order that has reached implementation (`approved`, or `done`) with no
    // such line was built against a preview nobody can open, which is the
    // failure 0.13.0 exists to end. Silent on `draft`/`in-review` — a work
    // order still being cut has not reached the gate — and on `ui: no`,
    // which never has a preview to publish.
    //
    // Front-matter only, like tst-without-regression: `ui:` moved into
    // front-matter at 0.8.0 and the log line is 0.13.0 doctrine. A
    // head-block corpus (the pinned archive) predates both and would report
    // every one of its UI work orders forever.
    if (cfg.grammar !== "front-matter") return;

    const IN_IMPLEMENTATION = new Set(["approved", "done"]);
    for (const n of graph.nodes) {
      if (n.y !== "work-order" || !n.u) continue;
      if (!IN_IMPLEMENTATION.has(n.s)) continue;

      const bodyText = n.b || "";
      const lines = bodyText.split("\n");
      const logAt = lines.findIndex((l) => /^#{1,3}\s+Log\s*$/.test(l));
      if (logAt === -1) {
        add("preview-without-url",
          `${n.i} is ${n.s} with ui: yes and has no \`## Log\` section`,
          "the published preview's URL lives there (rule 6.1's checkpoint) — /design publishes the sheet and logs it",
          n.i);
        continue;
      }
      let end = lines.length;
      for (let i = logAt + 1; i < lines.length; i++) {
        if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
      }
      const published = lines
        .slice(logAt + 1, end)
        .some((l) => /^\s*[-*]\s/.test(l) && /\bpreview\b/i.test(l) && /https?:\/\/\S+/.test(l));
      if (!published) {
        add("preview-without-url",
          `${n.i} is ${n.s} with ui: yes and its log records no published preview`,
          "add `- <date> preview — design-guardian — v<n> — <url>` via /design — rule 7.3's page, not just its file",
          n.i);
      }
    }
  },
};
