// ---- tst-heading-off-grammar -------------------------------------------

export default {
  id: "tst-heading-off-grammar",
  text: "a heading that opens with a TST id but is not read as a validation report",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // A heading that opens with a TST id but misses the validation-report
    // grammar is silently not a validation node. WO-084 sat `done` and
    // apparently unvalidated for a week on one parenthesis.
    for (const t of graph.health.tstHeadings || []) {
      add("tst-heading-off-grammar",
        `${t.id}: a heading opens with a TST id but is not read as a validation report`,
        `${t.line} — the grammar wants \`TST-### — title\`; this section's verdict is invisible until it does`,
        t.id);
    }
  },
};
