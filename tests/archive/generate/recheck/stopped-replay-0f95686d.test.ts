// Archived case of tests/generate/recheck/stopped-replay.test.ts (its helpers live there): the title's want of a specific is a warning now.
it("0f95686d with its fit_claim sentences dropped, as #2375 drops them, passes at 0¢ on the floor title, its want of a specific let go", async () => {
  const [row, world] = dogfood("0f95686d");
  const fit = (row.rule_failures as { rule: string; detail: { sentences?: string[] } }[]).find((each) => each.rule === "fit_claim")!.detail.sentences!;
  expect(fit.every((sentence) => row.body_md!.includes(sentence))).toBe(true);
  const outcome = await recheckRow({ ...row, body_md: fit.reduce((body, sentence) => body.replace(sentence, ""), row.body_md!) }, world);
  expect(outcome).toMatchObject({ kind: "checked", passed: true, failed: [], spentCents: 0, patch: { title: "Best AI search visibility tools (2026)" } });
});
