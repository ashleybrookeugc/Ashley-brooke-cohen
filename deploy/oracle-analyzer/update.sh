#!/bin/bash
# Pull a configured git ref, run tests in a separate worktree, and move the
# live checkout only when the tests pass. The frozen PocketSphinx engine-name
# failure is the only analyzer failure that may be ignored.
set -euo pipefail
umask 077

ALLOWED_DEFAULT='ASR preserves tested connector words and negation with versioned word timestamps'

classify_tap() {
  local file=$1 allowed=${ORACLE_ANALYZER_ALLOWED_TEST_FAILURE:-$ALLOWED_DEFAULT} fail=0 line name
  if ! grep -q '^TAP version ' "$file"; then
    echo "test output has no TAP header" >&2
    return 1
  fi
  while IFS= read -r line; do
    if [[ "$line" =~ ^not\ ok\ [0-9]+\ -\ (.*)$ ]]; then
      name=${BASH_REMATCH[1]}
      name=${name%% # *}
      if [[ "$name" != "$allowed" ]]; then
        echo "unexpected test failure: $name" >&2
        fail=1
      else
        echo "allowed known failure: $name" >&2
      fi
    fi
  done < "$file"
  return "$fail"
}

if [[ "${1:-}" == "--classify-tap" ]]; then
  classify_tap "$2"
  exit $?
fi

if [[ "${ORACLE_ANALYZER_UPDATE_REEXEC:-}" != 1 ]]; then
  install -d -m 0755 /run/oracle-analyzer
  cp "$0" /run/oracle-analyzer/update.sh
  chmod 0755 /run/oracle-analyzer/update.sh
  export ORACLE_ANALYZER_UPDATE_REEXEC=1
  exec /run/oracle-analyzer/update.sh "$@"
fi

ENV_FILE=${ORACLE_ANALYZER_ENV_FILE:-/etc/oracle-analyzer/analyzer.env}
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${ORACLE_ANALYZER_USER:=analyzer}"
: "${ORACLE_ANALYZER_ROOT:=/var/lib/oracle-analyzer}"
: "${ORACLE_ANALYZER_WEBSITE_DIR:=$ORACLE_ANALYZER_ROOT/website}"
: "${ORACLE_ANALYZER_ANALYZER_DIR:=$ORACLE_ANALYZER_ROOT/analyzer}"
: "${ORACLE_ANALYZER_WEBSITE_REF:=cursor/oracle-analyzer-arm64-22bd}"
: "${ORACLE_ANALYZER_ANALYZER_REF:=cursor/oss-video-extractors-8f87}"
: "${VIDEO_TEST_ROOT:=$ORACLE_ANALYZER_ROOT/data}"
: "${HF_HOME:=$ORACLE_ANALYZER_ROOT/models}"

exec 9>"$ORACLE_ANALYZER_ROOT/update.lock"
if ! flock -n 9; then
  echo "oracle-analyzer update: already running"
  exit 0
fi

job_active() {
  local job state
  [[ -d "$VIDEO_TEST_ROOT" ]] || return 1
  shopt -s nullglob
  for job in "$VIDEO_TEST_ROOT"/*/job.json; do
    state=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("state",""))' "$job" 2>/dev/null || true)
    if [[ "$state" == "running" || "$state" == "uploading" ]]; then
      return 0
    fi
  done
  return 1
}

run_as_analyzer() {
  runuser -u "$ORACLE_ANALYZER_USER" -- env \
    HOME="$ORACLE_ANALYZER_ROOT" \
    HF_HOME="$HF_HOME" \
    HF_HUB_DISABLE_TELEMETRY=1 \
    PIP_CACHE_DIR="$ORACLE_ANALYZER_ROOT/pip-cache" \
    GIT_TERMINAL_PROMPT=0 \
    PATH="/usr/local/bin:/usr/bin:/bin" \
    "$@"
}

fetch_sha() {
  local dir=$1 ref=$2
  run_as_analyzer git -C "$dir" fetch --prune origin "$ref" || return 1
  run_as_analyzer git -C "$dir" rev-parse FETCH_HEAD
}

test_analyzer() {
  local work=$1 tap err
  tap=$(mktemp)
  err=$(mktemp)
  set +e
  run_as_analyzer bash -lc "cd '$work' && node tools/video-analyzer/setup-runtime.mjs && node --test --test-reporter tap tests/video-analyzer.test.mjs" >"$tap" 2>"$err"
  set -e
  if classify_tap "$tap"; then
    rm -f "$tap" "$err"
    return 0
  fi
  echo "analyzer suite rejected this revision" >&2
  tail -n 40 "$err" >&2 || true
  rm -f "$tap" "$err"
  return 1
}

test_website() {
  local work=$1 tap err
  tap=$(mktemp)
  err=$(mktemp)
  set +e
  run_as_analyzer bash -lc "cd '$work' && node --test --test-reporter tap test/video-testing.test.js" >"$tap" 2>"$err"
  local code=$?
  set -e
  if [[ "$code" -eq 0 ]] && classify_tap "$tap" && ! grep -q '^not ok ' "$tap"; then
    rm -f "$tap" "$err"
    return 0
  fi
  echo "adapter tests failed" >&2
  tail -n 40 "$err" >&2 || true
  rm -f "$tap" "$err"
  return 1
}

prepare_worktree() {
  local dir=$1 sha=$2 work=$3
  run_as_analyzer git -C "$dir" worktree prune || return 1
  rm -rf "$work"
  run_as_analyzer git -C "$dir" worktree add --detach "$work" "$sha" || return 1
}

changed=0
update_one() {
  local name=$1 dir=$2 ref=$3 tester=$4
  local current new work
  current=$(run_as_analyzer git -C "$dir" rev-parse HEAD) || return 1
  new=$(fetch_sha "$dir" "$ref") || return 1
  if [[ "$current" == "$new" ]]; then
    echo "oracle-analyzer update: $name already at $new"
    return 0
  fi
  work="$ORACLE_ANALYZER_ROOT/work/${name}-test"
  install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0750 "$ORACLE_ANALYZER_ROOT/work"
  echo "oracle-analyzer update: testing $name $new"
  prepare_worktree "$dir" "$new" "$work" || return 1
  if ! "$tester" "$work"; then
    run_as_analyzer git -C "$dir" worktree remove --force "$work" || true
    echo "oracle-analyzer update: keeping $name at $current" >&2
    return 1
  fi
  run_as_analyzer git -C "$dir" checkout --detach "$new" || return 1
  run_as_analyzer git -C "$dir" worktree remove --force "$work" || true
  echo "oracle-analyzer update: $name moved to $new"
  changed=1
  if [[ "$name" == website ]]; then
    website_sha=$new
  else
    analyzer_sha=$new
  fi
}

website_ok=0
analyzer_ok=0
website_sha=$(run_as_analyzer git -C "$ORACLE_ANALYZER_WEBSITE_DIR" rev-parse HEAD)
analyzer_sha=$(run_as_analyzer git -C "$ORACLE_ANALYZER_ANALYZER_DIR" rev-parse HEAD)
if update_one website "$ORACLE_ANALYZER_WEBSITE_DIR" "$ORACLE_ANALYZER_WEBSITE_REF" test_website; then
  website_ok=1
fi
if update_one analyzer "$ORACLE_ANALYZER_ANALYZER_DIR" "$ORACLE_ANALYZER_ANALYZER_REF" test_analyzer; then
  analyzer_ok=1
fi

if [[ "$website_ok" -eq 1 && -n "${website_sha:-}" ]]; then
  script_src=$ORACLE_ANALYZER_WEBSITE_DIR
  for name in run-adapter.sh run-tunnel.sh healthcheck.sh update.sh backup-corrections.sh finish.sh create-worker-token.sh install-tunnel-credentials.sh apply-firewall.py; do
    if [[ -f "$script_src/deploy/oracle-analyzer/$name" ]]; then
      install -m 0755 "$script_src/deploy/oracle-analyzer/$name" "/usr/local/lib/oracle-analyzer/$name"
    fi
  done
  if [[ -d "$script_src/deploy/oracle-analyzer/systemd" ]]; then
    install -m 0644 "$script_src/deploy/oracle-analyzer/systemd/"*.service /etc/systemd/system/ || true
    install -m 0644 "$script_src/deploy/oracle-analyzer/systemd/"*.timer /etc/systemd/system/ || true
    if [[ -d /run/systemd/system ]]; then
      systemctl daemon-reload || true
    fi
  fi
fi

cat > "$ORACLE_ANALYZER_ROOT/last-good.env" <<EOF
WEBSITE_SHA=$(run_as_analyzer git -C "$ORACLE_ANALYZER_WEBSITE_DIR" rev-parse HEAD)
ANALYZER_SHA=$(run_as_analyzer git -C "$ORACLE_ANALYZER_ANALYZER_DIR" rev-parse HEAD)
EOF
chmod 0640 "$ORACLE_ANALYZER_ROOT/last-good.env"

if [[ "$changed" -eq 1 ]]; then
  if job_active; then
    echo "oracle-analyzer update: a job is active, so the adapter was not restarted"
    echo pending > "$ORACLE_ANALYZER_ROOT/restart-pending"
  elif [[ -d /run/systemd/system ]] && systemctl is-active --quiet oracle-analyzer-adapter.service; then
    systemctl restart oracle-analyzer-adapter.service
    rm -f "$ORACLE_ANALYZER_ROOT/restart-pending"
    echo "oracle-analyzer update: adapter restarted"
  else
    echo "oracle-analyzer update: adapter is not running, so it was not started"
  fi
elif [[ -f "$ORACLE_ANALYZER_ROOT/restart-pending" ]] && ! job_active; then
  if [[ -d /run/systemd/system ]] && systemctl is-active --quiet oracle-analyzer-adapter.service; then
    systemctl restart oracle-analyzer-adapter.service
    rm -f "$ORACLE_ANALYZER_ROOT/restart-pending"
    echo "oracle-analyzer update: deferred adapter restart completed"
  fi
fi

if [[ "$website_ok" -ne 1 || "$analyzer_ok" -ne 1 ]]; then
  exit 1
fi
echo "oracle-analyzer update: done"
