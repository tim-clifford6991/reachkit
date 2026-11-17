// The four step cards in one row at 1024px and up: the head's strip before the split head set them two by two beside the lead.
// Archived as it stood; it reads `measure` from tests/ui/layout/how-steps.test.ts.
it.each([1024, 1280])("at %ipx the four step titles share a top", async (width) => {
  const { stepTitleTops: tops } = await measure(width);
  expect(tops).toHaveLength(4);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
}, 120_000);
