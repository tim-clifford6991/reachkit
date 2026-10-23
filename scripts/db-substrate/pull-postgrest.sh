#!/usr/bin/env bash
# Pulls the PostgREST image for up.sh and prints the reference it got.
# Docker Hub refuses anonymous pulls from shared hosted-runner IPs, so ghcr.io comes first and Docker Hub is the last resort.
set -euo pipefail

PRIMARY="${POSTGREST_IMAGE:-ghcr.io/postgrest/postgrest:v16.2}"
FALLBACK="${POSTGREST_FALLBACK_IMAGE:-postgrest/postgrest:v16.2}"

for image in "$PRIMARY" "$FALLBACK"; do
  docker image inspect "$image" >/dev/null 2>&1 && { echo "$image"; exit 0; }
  for delay in 5 15 30 0; do
    if docker pull -q "$image" >&2; then echo "$image"; exit 0; fi
    [[ "$delay" -gt 0 ]] || break
    echo "db-substrate: pulling ${image} failed, retrying in ${delay}s" >&2
    sleep "$delay"
  done
done

echo "db-substrate: could not pull PostgREST from ${PRIMARY} or ${FALLBACK}" >&2
exit 1
