#!/bin/bash
# Copies a cloudflared tunnel credentials file into the root-owned config dir
# and writes a 404-only ingress. There is no public hostname.
set -euo pipefail
umask 077

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
uuid=${1:-}
if [[ ! "$uuid" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "usage: install-tunnel-credentials.sh TUNNEL_UUID" >&2
  exit 1
fi

src=""
for candidate in "/home/ubuntu/.cloudflared/${uuid}.json" "/root/.cloudflared/${uuid}.json"; do
  if [[ -f "$candidate" ]]; then
    src=$candidate
    break
  fi
done
if [[ -z "$src" ]]; then
  echo "Could not find ${uuid}.json under /home/ubuntu/.cloudflared or /root/.cloudflared" >&2
  exit 1
fi

install -d -o root -g analyzer -m 0750 /etc/oracle-analyzer/cloudflared
install -o root -g analyzer -m 0440 "$src" "/etc/oracle-analyzer/cloudflared/${uuid}.json"
cat > /etc/oracle-analyzer/cloudflared/config.yml <<EOF
tunnel: ${uuid}
credentials-file: /etc/oracle-analyzer/cloudflared/${uuid}.json
ingress:
  - service: http_status:404
EOF
chown root:analyzer /etc/oracle-analyzer/cloudflared/config.yml
chmod 0440 /etc/oracle-analyzer/cloudflared/config.yml
echo "Wrote a 404-only tunnel config for ${uuid}. No public hostname was added."
