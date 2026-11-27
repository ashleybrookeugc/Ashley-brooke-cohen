#!/bin/bash
# Idempotent first-boot and re-run setup for the private video analyzer.
# Safe to run more than once. Does not print secrets. Does not enable UFW.
set -euo pipefail
umask 022

ENV_FILE=${ORACLE_ANALYZER_ENV_FILE:-/etc/oracle-analyzer/analyzer.env}
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

: "${ORACLE_ANALYZER_WEBSITE_REPO:=https://github.com/ashleybrookeugc/Ashley-brooke-cohen.git}"
: "${ORACLE_ANALYZER_WEBSITE_REF:=cursor/oracle-analyzer-arm64-22bd}"
: "${ORACLE_ANALYZER_ANALYZER_REPO:=https://github.com/ashleybrookeugc/Ashley-brooke-cohen.git}"
: "${ORACLE_ANALYZER_ANALYZER_REF:=cursor/oss-video-extractors-8f87}"
: "${ORACLE_ANALYZER_USER:=analyzer}"
: "${ORACLE_ANALYZER_ROOT:=/var/lib/oracle-analyzer}"
: "${ORACLE_ANALYZER_WEBSITE_DIR:=$ORACLE_ANALYZER_ROOT/website}"
: "${ORACLE_ANALYZER_ANALYZER_DIR:=$ORACLE_ANALYZER_ROOT/analyzer}"
: "${VIDEO_TEST_ROOT:=$ORACLE_ANALYZER_ROOT/data}"
: "${HF_HOME:=$ORACLE_ANALYZER_ROOT/models}"

NODE_VERSION=v24.22.2
NODE_SHA256_ARM64=eb187837a2230d4047161ac0be008584e16b46f726e9c9490ee35dc6b17d9ba8
CLOUDFLARED_VERSION=2026.10.7
CLOUDFLARED_SHA256_ARM64=d9407eb6e70ac31f54978a6b408a0320b51b664a6d0b498248692d7ac56bf836
LIB_DIR=/usr/local/lib/oracle-analyzer
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

log() { printf 'oracle-analyzer: %s\n' "$*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap.sh must run as root" >&2
  exit 1
fi

arch=$(dpkg --print-architecture)
if [[ "$arch" != arm64 ]]; then
  echo "This host setup is for Oracle Ampere A1 (Debian architecture arm64). This machine is $arch." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  xz-utils \
  git \
  ffmpeg \
  python3 \
  python3-venv \
  python3.12 \
  python3.12-venv \
  iptables \
  openssl \
  age \
  unattended-upgrades

# tesseract is intentionally not installed. The pinned analyzer uses RapidOCR.

install -d -m 0755 /etc/apt/apt.conf.d
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52oracle-analyzer-unattended <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
EOF
systemctl enable unattended-upgrades.service >/dev/null 2>&1 || true

if ! id "$ORACLE_ANALYZER_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$ORACLE_ANALYZER_ROOT" --shell /usr/sbin/nologin --user-group "$ORACLE_ANALYZER_USER"
fi
install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0750 "$ORACLE_ANALYZER_ROOT"
install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0700 "$VIDEO_TEST_ROOT"
install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0700 "$HF_HOME"
install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0700 "$ORACLE_ANALYZER_ROOT/pip-cache"
install -d -o root -g "$ORACLE_ANALYZER_USER" -m 0750 /etc/oracle-analyzer
install -d -o root -g "$ORACLE_ANALYZER_USER" -m 0750 /etc/oracle-analyzer/secrets
install -d -o root -g "$ORACLE_ANALYZER_USER" -m 0750 /etc/oracle-analyzer/cloudflared
if [[ -f /etc/oracle-analyzer/analyzer.env ]]; then
  chown root:"$ORACLE_ANALYZER_USER" /etc/oracle-analyzer/analyzer.env
  chmod 0640 /etc/oracle-analyzer/analyzer.env
fi

if ! /usr/local/bin/node -v 2>/dev/null | grep -qx "$NODE_VERSION"; then
  tmp=$(mktemp)
  url="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-arm64.tar.xz"
  curl -fsSL --retry 3 -o "$tmp" "$url"
  echo "${NODE_SHA256_ARM64}  ${tmp}" | sha256sum -c -
  install -d /usr/local/lib/nodejs
  tar -xJf "$tmp" -C /usr/local/lib/nodejs
  rm -f "$tmp"
  ln -sfn "/usr/local/lib/nodejs/node-${NODE_VERSION}-linux-arm64" /usr/local/lib/nodejs/current
  ln -sfn /usr/local/lib/nodejs/current/bin/node /usr/local/bin/node
  ln -sfn /usr/local/lib/nodejs/current/bin/npm /usr/local/bin/npm
  ln -sfn /usr/local/lib/nodejs/current/bin/npx /usr/local/bin/npx
fi
log "node $(/usr/local/bin/node -v)"

if ! cloudflared --version 2>/dev/null | grep -q "$CLOUDFLARED_VERSION"; then
  tmp=$(mktemp --suffix=.deb)
  url="https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-arm64.deb"
  curl -fsSL --retry 3 -o "$tmp" "$url"
  echo "${CLOUDFLARED_SHA256_ARM64}  ${tmp}" | sha256sum -c -
  apt-get install -y "$tmp"
  rm -f "$tmp"
fi
log "cloudflared $(cloudflared --version 2>&1 | head -n 1)"

install -d -m 0755 /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-oracle-analyzer.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
EOF
if [[ -d /run/systemd/system ]]; then
  systemctl reload ssh >/dev/null 2>&1 || systemctl reload sshd >/dev/null 2>&1 || log "sshd reload skipped"
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  echo "UFW is active. Oracle Ubuntu images can fail to reboot when UFW removes the iSCSI boot-volume rules. Disable UFW only after the rules in /etc/iptables/rules.v4 are confirmed, and do not re-enable it." >&2
  exit 1
fi

if [[ -f /etc/iptables/rules.v4 ]]; then
  new=$(mktemp)
  if python3 "$SCRIPT_DIR/apply-firewall.py" /etc/iptables/rules.v4 > "$new"; then
    if ! grep -q '169.254.' "$new"; then
      echo "firewall rewrite dropped the iSCSI rules; original file left in place" >&2
      rm -f "$new"
      exit 1
    fi
    cp -a /etc/iptables/rules.v4 "/etc/iptables/rules.v4.oracle-analyzer-bak"
    cp "$new" /etc/iptables/rules.v4
    chmod 0640 /etc/iptables/rules.v4
    if iptables-restore < /etc/iptables/rules.v4; then
      log "inbound firewall allows TCP 22 and keeps the Oracle iSCSI rules"
    else
      cp -a "/etc/iptables/rules.v4.oracle-analyzer-bak" /etc/iptables/rules.v4
      iptables-restore < /etc/iptables/rules.v4 || true
      echo "iptables-restore failed; previous rules restored" >&2
      rm -f "$new"
      exit 1
    fi
    rm -f "$new"
  else
    rm -f "$new"
    exit 1
  fi
else
  log "no /etc/iptables/rules.v4 yet; inbound firewall was not changed"
fi

clone_checkout() {
  local dest=$1 repo=$2 ref=$3
  if [[ -d "$dest/.git" ]]; then
    log "leaving existing checkout $dest for the update timer"
    return 0
  fi
  install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0750 "$(dirname "$dest")"
  GIT_TERMINAL_PROMPT=0 git -c safe.directory='*' clone "$repo" "$dest"
  git -c safe.directory='*' -C "$dest" fetch origin "$ref"
  git -c safe.directory='*' -C "$dest" checkout --detach FETCH_HEAD
  chown -R "$ORACLE_ANALYZER_USER:$ORACLE_ANALYZER_USER" "$dest"
  log "checked out $ref at $(git -c safe.directory='*' -C "$dest" rev-parse --short HEAD) in $dest"
}

clone_checkout "$ORACLE_ANALYZER_WEBSITE_DIR" "$ORACLE_ANALYZER_WEBSITE_REPO" "$ORACLE_ANALYZER_WEBSITE_REF"
clone_checkout "$ORACLE_ANALYZER_ANALYZER_DIR" "$ORACLE_ANALYZER_ANALYZER_REPO" "$ORACLE_ANALYZER_ANALYZER_REF"

runuser -u "$ORACLE_ANALYZER_USER" -- env \
  HOME="$ORACLE_ANALYZER_ROOT" \
  HF_HOME="$HF_HOME" \
  HF_HUB_DISABLE_TELEMETRY=1 \
  PIP_CACHE_DIR="$ORACLE_ANALYZER_ROOT/pip-cache" \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  /usr/local/bin/node "$ORACLE_ANALYZER_ANALYZER_DIR/tools/video-analyzer/setup-runtime.mjs"

runuser -u "$ORACLE_ANALYZER_USER" -- env \
  HOME="$ORACLE_ANALYZER_ROOT" \
  HF_HUB_DISABLE_TELEMETRY=1 \
  "$ORACLE_ANALYZER_ANALYZER_DIR/.video-analysis-runtime/venv/bin/python" -c 'from rapidocr import RapidOCR; RapidOCR(params={"Global.log_level":"error"}); print("rapidocr-warm")'

install -d -m 0755 "$LIB_DIR"
for name in run-adapter.sh run-tunnel.sh healthcheck.sh update.sh backup-corrections.sh finish.sh create-worker-token.sh install-tunnel-credentials.sh apply-firewall.py; do
  install -m 0755 "$SCRIPT_DIR/$name" "$LIB_DIR/$name"
done
cat > "$LIB_DIR/versions.env" <<EOF
NODE_VERSION=$NODE_VERSION
CLOUDFLARED_VERSION=$CLOUDFLARED_VERSION
EOF
chmod 0644 "$LIB_DIR/versions.env"

install -d -m 0755 /etc/systemd/system
for unit in oracle-analyzer-adapter.service oracle-analyzer-tunnel.service oracle-analyzer-update.service oracle-analyzer-update.timer oracle-analyzer-backup.service oracle-analyzer-backup.timer; do
  install -m 0644 "$SCRIPT_DIR/systemd/$unit" "/etc/systemd/system/$unit"
done

if [[ -d /run/systemd/system ]]; then
  systemctl daemon-reload
  systemctl enable oracle-analyzer-update.timer oracle-analyzer-backup.timer
  systemctl start oracle-analyzer-update.timer oracle-analyzer-backup.timer || true
  log "update and backup timers enabled (backup stays inactive until ORACLE_ANALYZER_BACKUP_ENABLED=1)"
else
  log "systemd is not running; unit files are installed and were not enabled"
fi

cat > "$ORACLE_ANALYZER_ROOT/last-good.env" <<EOF
WEBSITE_SHA=$(git -C "$ORACLE_ANALYZER_WEBSITE_DIR" rev-parse HEAD)
ANALYZER_SHA=$(git -C "$ORACLE_ANALYZER_ANALYZER_DIR" rev-parse HEAD)
EOF
chown root:"$ORACLE_ANALYZER_USER" "$ORACLE_ANALYZER_ROOT/last-good.env"
chmod 0640 "$ORACLE_ANALYZER_ROOT/last-good.env"

log "bootstrap finished"
log "next: create the worker token, create the private tunnel, then run finish.sh"
log "see docs/ORACLE_ANALYZER_RUNBOOK.md"
