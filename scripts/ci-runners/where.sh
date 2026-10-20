#!/usr/bin/env bash
# Where this run's jobs go, for ci.yml's `what changed`: `light` is the light
# jobs' runs-on JSON and `browser_hosted` sends the sweep to ubuntu-latest.
# Off a pull request (the nightly, a dispatch) every job runs on reachkit-box,
# so the nightly costs no hosted minutes. Anything but `browser_hosted=true`
# sends the sweep to reachkit-box, the one runner labelled `reachkit`.
# Reads EVENT, LIGHT (vars.CI_LIGHT_RUNNER) and ON_BOX (vars.CI_BROWSER_ON_BOX).
set -euo pipefail
box='["self-hosted","reachkit"]'
light="${LIGHT:-\"ubuntu-latest\"}"
hosted=false
if [ "${EVENT:-}" != pull_request ]; then
  light=$box
  why="not a pull request (${EVENT:-none}): every job runs on reachkit-box, no hosted minutes"
elif [ -n "${LIGHT:-}" ]; then
  why="CI_LIGHT_RUNNER is set: the sweep follows the light jobs off hosted, to reachkit-box"
elif [ -n "${ON_BOX:-}" ]; then
  why="CI_BROWSER_ON_BOX is set: the sweep runs on reachkit-box"
else
  hosted=true
  why="a pull request with neither CI_LIGHT_RUNNER nor CI_BROWSER_ON_BOX set: the sweep runs GitHub-hosted"
fi
printf 'light=%s\nbrowser_hosted=%s\n' "$light" "$hosted" | tee -a "${GITHUB_OUTPUT:-/dev/null}"
echo "$why"
