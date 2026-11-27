#!/bin/bash
# Starts the loopback adapter. The bearer token is read from a root-owned file
# and exported for the node process. It is never printed and never passed as an argument.
set -euo pipefail
umask 077

ENV_FILE=${ORACLE_ANALYZER_ENV_FILE:-/etc/oracle-analyzer/analyzer.env}
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

token_file=${ORACLE_ANALYZER_WORKER_TOKEN_FILE:-/etc/oracle-analyzer/secrets/worker-token}
if [[ ! -f "$token_file" ]]; then
  echo "oracle-analyzer: worker token file is missing" >&2
  exit 1
fi
mode=$(stat -c %a "$token_file")
other=$((10#$mode % 10))
if (( other != 0 )); then
  echo "oracle-analyzer: worker token file is readable by users other than root and the analyzer group" >&2
  exit 1
fi
VIDEO_TEST_WORKER_TOKEN=$(tr -d '[:space:]' < "$token_file")
export VIDEO_TEST_WORKER_TOKEN
if ((${#VIDEO_TEST_WORKER_TOKEN} < 32)); then
  echo "oracle-analyzer: worker token is shorter than 32 characters" >&2
  exit 1
fi

export VIDEO_ANALYZER_MODULE=${VIDEO_ANALYZER_MODULE:-/var/lib/oracle-analyzer/analyzer/tools/video-analyzer/core.mjs}
export VIDEO_TEST_ROOT=${VIDEO_TEST_ROOT:-/var/lib/oracle-analyzer/data}
export HF_HOME=${HF_HOME:-/var/lib/oracle-analyzer/models}
export HF_HUB_DISABLE_TELEMETRY=1
export PORT=${PORT:-8789}
cd "${ORACLE_ANALYZER_WEBSITE_DIR:-/var/lib/oracle-analyzer/website}"
exec /usr/local/bin/node tools/video-testing/server.mjs
