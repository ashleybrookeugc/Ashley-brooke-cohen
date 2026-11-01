#!/bin/bash
# Creates the adapter bearer token once and prints it once.
set -euo pipefail
umask 077

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

file=/etc/oracle-analyzer/secrets/worker-token
install -d -o root -g analyzer -m 0750 /etc/oracle-analyzer/secrets
if [[ -f "$file" ]]; then
  echo "The worker token already exists at $file and was not printed again." >&2
  exit 0
fi
token=$(openssl rand -hex 32)
printf '%s\n' "$token" > "$file"
chown root:analyzer "$file"
chmod 0440 "$file"
echo "Copy this value into the Cloudflare worker secret. It will not be printed again."
printf '%s\n' "$token"
