#!/bin/bash
# Runs cloudflared with a 404-only local config, or with a token file.
# The token is passed in the environment so it does not appear in the process arguments.
set -euo pipefail
umask 077

token_file=/etc/oracle-analyzer/secrets/tunnel-token
config=/etc/oracle-analyzer/cloudflared/config.yml

if [[ -f "$token_file" ]]; then
  mode=$(stat -c %a "$token_file")
  other=$((10#$mode % 10))
  if (( other != 0 )); then
    echo "oracle-analyzer: tunnel token file is readable by others" >&2
    exit 1
  fi
  TUNNEL_TOKEN=$(tr -d '[:space:]' < "$token_file")
  export TUNNEL_TOKEN
  if [[ -z "$TUNNEL_TOKEN" ]]; then
    echo "oracle-analyzer: tunnel token file is empty" >&2
    exit 1
  fi
  exec /usr/bin/cloudflared tunnel --no-autoupdate run
fi

if [[ ! -f "$config" ]]; then
  echo "oracle-analyzer: tunnel config is missing. Create it with install-tunnel-credentials.sh, or place a token file." >&2
  exit 1
fi
exec /usr/bin/cloudflared tunnel --no-autoupdate --config "$config" run
