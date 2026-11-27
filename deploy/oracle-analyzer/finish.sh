#!/bin/bash
# Enable the adapter and the tunnel after the token and tunnel files exist.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if [[ ! -d /run/systemd/system ]]; then
  echo "systemd is not running, so the services cannot be started" >&2
  exit 1
fi
if [[ ! -f /etc/oracle-analyzer/secrets/worker-token ]]; then
  echo "Create the worker token first: /usr/local/lib/oracle-analyzer/create-worker-token.sh" >&2
  exit 1
fi
if [[ ! -f /etc/oracle-analyzer/cloudflared/config.yml && ! -f /etc/oracle-analyzer/secrets/tunnel-token ]]; then
  echo "Create the private tunnel first: /usr/local/lib/oracle-analyzer/install-tunnel-credentials.sh TUNNEL_UUID" >&2
  exit 1
fi
systemctl enable --now oracle-analyzer-adapter.service oracle-analyzer-tunnel.service
sleep 2
exec /usr/local/lib/oracle-analyzer/healthcheck.sh
