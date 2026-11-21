// The one place the evaluation's files may be written: its ledgers, results and kept answers hold production answers
// and spend, so they stay in this private folder on the box, never in the public repository or a shared folder.
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export const EVAL_DIR = "/root/ops/reachkit/eval";

/** The path with its nearest existing folder's links resolved, so a link cannot lead out of the evaluation folder. */
function realish(file) {
  let at = path.resolve(file);
  const rest = [];
  while (!existsSync(at) && path.dirname(at) !== at) {
    rest.unshift(path.basename(at));
    at = path.dirname(at);
  }
  return path.join(realpathSync(at), ...rest);
}

/** Whether a file to be written is inside the evaluation folder (not the folder itself). */
export function underEvalDir(file) {
  const rel = path.relative(realish(EVAL_DIR), realish(file));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** `file`, or a refusal naming the flag, where it would be written outside the evaluation folder. */
export function evalFile(flagName, file) {
  if (!underEvalDir(file)) throw new Error(`${flagName} must be a file under ${EVAL_DIR}/ (the evaluation's private folder); got ${file}.`);
  return file;
}
