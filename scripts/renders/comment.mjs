// scripts/renders/comment.mjs — the render comment CI leaves on the PR (issue #404)
//
// One comment per layout run: the approved screen beside what the branch
// renders, embedded, plus the link to the run's artifact for anything the
// comment does not show. The images are served from the PR's own
// `assets/<n>-fidelity` branch — the branch implementers used to push by
// hand, now pushed by `publish.sh` — because a workflow artifact is a zip
// and GitHub will not render a picture out of one.
//
//     node scripts/renders/comment.mjs \
//       --renders <dir>/renders.json --raw <base url> --artifact <url> --run <id>
import { readFileSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  return args;
}

const args = parseArgs(process.argv.slice(2));
const { rendered, skipped } = JSON.parse(readFileSync(args.renders, "utf8"));

const lines = [];
lines.push(`### Renders — the approved screen beside this branch, at 1280 light`);
lines.push("");
if (rendered.length === 0) {
  lines.push(
    "No screen this branch renders differs from `main`'s baselines, so there is nothing to compare."
  );
  lines.push(
    "Name a route under `Renders:` in the PR body to have one composed anyway."
  );
} else {
  lines.push(
    `${rendered.length} surface(s) moved. **Left is \`docs/design/approved/full-set/screens/\`; right is this branch.**`
  );
  lines.push("");
  for (const row of rendered) {
    lines.push(`#### \`${row.route}\` — ${row.screen} · ${row.name}`);
    lines.push("");
    lines.push(`${row.why} · approved: \`${path.basename(row.approved)}\``);
    lines.push("");
    lines.push(`![${row.name}](${args.raw}/${row.file})`);
    lines.push("");
  }
}
lines.push("");
if (skipped.length > 0) {
  lines.push("<details><summary>Not composed</summary>");
  lines.push("");
  for (const row of skipped) lines.push(`- \`${row.name}\` — ${row.reason}`);
  lines.push("");
  lines.push("</details>");
  lines.push("");
}
lines.push(
  `Every capture of this run, including the ones that did not move: [artifact](${args.artifact}) · [run](${args.run}).`
);
lines.push("");
lines.push(
  "_Posted by CI (issue #404). Renders are not built on the box — see `docs/PROCESS.md` §2.4._"
);

process.stdout.write(lines.join("\n") + "\n");
