// tests/presentation/copy/__fixtures__/surfaces/src/app/violation-questions-wording.tsx
//
// WO-279 fixture (supersedes WO-044). `questions.wording` is one of
// GeneratedColumn's seven columns and its only sanctioned sink is
// renderQuestion() (BP-020 `## Public interface`) — reaching JSX directly,
// as here, is the same raw-column-read violation as `drafts.body`, caught
// by the same rule (WO-279 `## Test plan`, WO-044 row: "questions.wording
// reaches a surface only through renderQuestion"). Exactly one violation.
export function ViolationQuestionsWording(p: { questions: { wording: string } }) {
  const { questions } = p;
  return <p>{questions.wording}</p>;
}
