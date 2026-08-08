#!/bin/bash
# Invoked by launchd (see com.blindtestgenerator.dailypipeline.plist) once a
# day. launchd runs with a minimal environment — no shell profile, no PATH
# beyond the system default — so everything the pipeline needs is set
# explicitly here rather than assumed from the calling shell.
set -euo pipefail

export PATH="$HOME/.local/share/node/node-v24.19.0-darwin-arm64/bin:/usr/local/bin:/usr/bin:/bin"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/apps/pipeline"

exec node --env-file="$REPO_ROOT/.env" dist/index.js "$REPO_ROOT/channels/blindtest-fr.json"
