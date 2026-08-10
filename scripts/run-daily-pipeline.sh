#!/bin/bash
# Invoked by launchd (see com.blindtestgenerator.dailypipeline.plist) once a
# day. launchd runs with a minimal environment — no shell profile, no PATH
# beyond the system default — so everything the pipeline needs is set
# explicitly here rather than assumed from the calling shell.
set -euo pipefail

export PATH="$HOME/.local/share/node/node-v24.19.0-darwin-arm64/bin:/usr/local/bin:/usr/bin:/bin"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/apps/pipeline"

# The 6am fire time can land right as the Mac wakes from sleep, before Wi-Fi
# has reconnected — confirmed live: the pipeline crashed on a DNS failure
# reaching Spotify because the network genuinely wasn't up yet. Wait for it
# instead of assuming it's already there.
attempt=0
max_attempts=24 # 24 * 5s = 2 minutes
until curl -sf --max-time 3 -o /dev/null https://accounts.spotify.com; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Réseau toujours indisponible après ${max_attempts} tentatives, on continue quand même." >&2
    break
  fi
  sleep 5
done

exec node --env-file="$REPO_ROOT/.env" dist/index.js "$REPO_ROOT/channels/blindtest-fr.json"
