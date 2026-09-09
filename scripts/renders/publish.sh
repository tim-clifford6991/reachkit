#!/usr/bin/env bash
# scripts/renders/publish.sh <pr> <run-id> <dir> — the renders, where a comment can show them
#
# Pushes this run's side-by-sides onto the PR's own `assets/<pr>-fidelity`
# branch — the branch implementers pushed by hand before issue #404 — under
# `renders/run-<id>/`, and prints on stdout the raw base URL those files are
# served at. A workflow artifact is a zip and GitHub will not render a
# picture out of one, so a comment that shows anything needs the file on a
# branch; this repository is public, so `raw.githubusercontent.com` is what
# a comment can embed.
#
# The branch keeps the newest three runs and drops the rest: a superseded
# comment keeps its pictures for a while, and a PR pushed to twenty times
# does not carry twenty copies of the same screen. The branch is deleted
# alongside the PR's own when the lander merges.
set -euo pipefail

pr="${1:?usage: publish.sh <pr> <run-id> <dir>}"
run="${2:?usage: publish.sh <pr> <run-id> <dir>}"
dir="${3:?usage: publish.sh <pr> <run-id> <dir>}"
: "${GITHUB_TOKEN:?publish.sh needs GITHUB_TOKEN}"
: "${GITHUB_REPOSITORY:?publish.sh needs GITHUB_REPOSITORY}"

branch="assets/${pr}-fidelity"
work="$(mktemp -d)"
repo="$(git rev-parse --show-toplevel)"
auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
remote="https://github.com/${GITHUB_REPOSITORY}.git"

# What the branch already holds, if it holds anything. `ls-remote` first so a
# missing branch is the ordinary case rather than a fetch error, and a
# dedicated ref so a `FETCH_HEAD` some earlier step left behind can never be
# mistaken for this one.
if git -C "$repo" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  git -C "$repo" fetch -q --depth=1 origin "+refs/heads/${branch}:refs/rk/fidelity"
  git -C "$repo" archive refs/rk/fidelity | tar -x -C "$work"
fi

mkdir -p "$work/renders/run-${run}"
cp "$dir"/side-*.png "$work/renders/run-${run}/" 2>/dev/null || true
cp "$dir"/renders.json "$work/renders/run-${run}/"

# Newest three run directories; the rest go. GitHub hands out run ids
# monotonically, so a version sort is the age order.
if [ -d "$work/renders" ]; then
  ls -1 "$work/renders" | sort -V | head -n -3 | while read -r old; do
    [ -n "$old" ] && rm -rf "${work:?}/renders/${old}"
  done
fi

cd "$work"
git init -q -b "$branch"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git -c commit.gpgsign=false commit -q -m "assets(#${pr}): side-by-side renders from run ${run}"
# One orphan commit per push, force: this branch is a picture board, not a
# history, and every run rewrites the board it shows.
git -c "http.https://github.com/.extraheader=${auth}" push -q --force "$remote" "HEAD:refs/heads/${branch}"

echo "https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${branch}/renders/run-${run}"
