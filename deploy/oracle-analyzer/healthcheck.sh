#!/bin/bash
# Read-only self-check. Prints pass/fail lines and never prints secret values.
set -euo pipefail
umask 077

fail=0
note() { printf '%s\n' "$*"; }
bad() { note "FAIL $*"; fail=1; }
good() { note "OK   $*"; }

ENV_FILE=${ORACLE_ANALYZER_ENV_FILE:-/etc/oracle-analyzer/analyzer.env}
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
LIB_DIR=/usr/local/lib/oracle-analyzer
if [[ -f "$LIB_DIR/versions.env" ]]; then
  # shellcheck disable=SC1091
  source "$LIB_DIR/versions.env"
fi

if [[ -x /usr/local/bin/node ]] && [[ "$(/usr/local/bin/node -v 2>/dev/null || true)" == "${NODE_VERSION:-v24.22.2}" ]]; then
  good "node ${NODE_VERSION:-v24.22.2}"
else
  bad "node is not ${NODE_VERSION:-v24.22.2}"
fi

if cloudflared --version 2>/dev/null | grep -q "${CLOUDFLARED_VERSION:-2026.10.7}"; then
  good "cloudflared ${CLOUDFLARED_VERSION:-2026.10.7}"
else
  bad "cloudflared is not ${CLOUDFLARED_VERSION:-2026.10.7}"
fi

if ffmpeg -version >/dev/null 2>&1 && ffprobe -version >/dev/null 2>&1; then
  good "ffmpeg and ffprobe"
else
  bad "ffmpeg or ffprobe missing"
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  bad "UFW is active; Oracle Ubuntu can fail to reboot after UFW removes iSCSI rules"
else
  good "UFW is not active"
fi

rules=/etc/iptables/rules.v4
if [[ -f "$rules" ]] && grep -q '169.254.' "$rules" && grep -q ':INPUT DROP' "$rules" && grep -q 'oracle-analyzer-ssh' "$rules"; then
  good "iptables keeps iSCSI rules and drops inbound except SSH"
elif [[ ! -f "$rules" ]]; then
  bad "Oracle iptables rules file is missing, so inbound lockdown was not applied"
else
  bad "iptables rules are missing the SSH lockdown or the iSCSI endpoints"
fi

module=${VIDEO_ANALYZER_MODULE:-/var/lib/oracle-analyzer/analyzer/tools/video-analyzer/core.mjs}
python=$(dirname "$module")/../../.video-analysis-runtime/venv/bin/python
python=$(readlink -f "$python" 2>/dev/null || echo "$python")
self_check=$(dirname "$module")/runtime-self-check.py
if [[ -x "$python" && -f "$self_check" ]]; then
  if "$python" "$self_check" | grep -q '"rapidocr"'; then
    good "RapidOCR runtime self-check"
  else
    bad "runtime self-check did not report rapidocr"
  fi
else
  bad "analyzer Python runtime is not installed"
fi

token_file=${ORACLE_ANALYZER_WORKER_TOKEN_FILE:-/etc/oracle-analyzer/secrets/worker-token}
adapter_active=0
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet oracle-analyzer-adapter.service 2>/dev/null; then
  adapter_active=1
fi

if python3 - <<'PY'
import pathlib, sys
port = f"{8789:04X}"
bad = []
for name in ("tcp", "tcp6"):
    path = pathlib.Path(f"/proc/net/{name}")
    if not path.exists():
        continue
    lines = path.read_text().splitlines()[1:]
    for line in lines:
        parts = line.split()
        if len(parts) < 4 or parts[3] != "0A":
            continue
        local, local_port = parts[1].split(":")
        if local_port.upper() != port:
            continue
        if name == "tcp" and local.upper() == "0100007F":
            continue
        bad.append(f"{name} {local}:{local_port}")
if bad:
    print("unexpected listeners: " + ", ".join(bad), file=sys.stderr)
    sys.exit(1)
PY
then
  if [[ "$adapter_active" -eq 1 ]]; then
    good "adapter is not listening on a public address"
  else
    note "SKIP adapter bind check; service is not running"
  fi
else
  bad "port 8789 is open on an address other than 127.0.0.1"
fi

if [[ "$adapter_active" -eq 1 ]]; then
  if [[ ! -f "$token_file" ]]; then
    bad "adapter is running but the worker token file is missing"
  else
    mode=$(stat -c %a "$token_file")
    other=$((10#$mode % 10))
    if (( other != 0 )); then
      bad "worker token file is readable by others"
    else
      cfg=$(mktemp)
      chmod 600 "$cfg"
      printf 'header = "Authorization: Bearer %s"\n' "$(tr -d '[:space:]' < "$token_file")" > "$cfg"
      body=$(curl --config "$cfg" --silent --show-error --max-time 20 "http://127.0.0.1:${PORT:-8789}/video-worker/health" || true)
      rm -f "$cfg"
      if printf '%s' "$body" | grep -q '"state":"available"'; then
        good "loopback health is available"
      else
        bad "loopback health is not available"
      fi
    fi
  fi
else
  note "SKIP loopback health; adapter service is not running"
fi

config=/etc/oracle-analyzer/cloudflared/config.yml
token_tunnel=/etc/oracle-analyzer/secrets/tunnel-token
if [[ -f "$config" ]]; then
  if python3 - "$config" <<'PY'
import sys
path = sys.argv[1]
services = []
for raw in open(path, encoding="utf-8"):
    line = raw.split("#", 1)[0].rstrip()
    stripped = line.strip()
    if not stripped:
        continue
    key, _, value = stripped.partition(":")
    if key.strip() == "hostname":
        sys.exit("hostname key is present")
    if key.strip() == "service":
        services.append(value.strip())
if services != ["http_status:404"]:
    sys.exit("ingress is not the single 404 catch-all")
PY
  then
    good "cloudflared ingress is 404-only with no hostname"
  else
    bad "cloudflared config is not a 404-only catch-all"
  fi
elif [[ -f "$token_tunnel" ]]; then
  note "WARN tunnel uses a token, so the 404-only ingress must be confirmed on the Cloudflare tunnel page"
else
  note "SKIP tunnel config; credentials are not installed yet"
fi

if [[ "${ORACLE_ANALYZER_BACKUP_ENABLED:-0}" == "1" ]]; then
  note "backup is enabled; confirm the destination repository is private and contains no video files"
else
  good "corrections backup is disabled"
fi

if (( fail != 0 )); then
  note "healthcheck failed"
  exit 1
fi
note "healthcheck passed"
