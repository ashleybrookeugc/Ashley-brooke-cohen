#!/bin/bash
# Copy creator correction JSON to a private git repo. Disabled unless
# ORACLE_ANALYZER_BACKUP_ENABLED=1. Never copies raw footage, frames, audio,
# evidence packages, or job files. A local filesystem remote is accepted only
# when ORACLE_ANALYZER_BACKUP_TEST=1, for the repository test.
set -euo pipefail
umask 077

ENV_FILE=${ORACLE_ANALYZER_ENV_FILE:-/etc/oracle-analyzer/analyzer.env}
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ "${ORACLE_ANALYZER_BACKUP_ENABLED:-0}" != "1" ]]; then
  echo "oracle-analyzer backup: disabled"
  exit 0
fi

: "${ORACLE_ANALYZER_USER:=analyzer}"
: "${ORACLE_ANALYZER_ROOT:=/var/lib/oracle-analyzer}"
: "${VIDEO_TEST_ROOT:=$ORACLE_ANALYZER_ROOT/data}"
: "${ORACLE_ANALYZER_BACKUP_BRANCH:=main}"
repo=${ORACLE_ANALYZER_BACKUP_REPO:-}
local_remote=${ORACLE_ANALYZER_BACKUP_LOCAL_REMOTE:-}
test_mode=${ORACLE_ANALYZER_BACKUP_TEST:-0}
token_file=${ORACLE_ANALYZER_BACKUP_TOKEN_FILE:-/etc/oracle-analyzer/secrets/backup-github-token}
recipient=${ORACLE_ANALYZER_BACKUP_AGE_RECIPIENT:-/etc/oracle-analyzer/secrets/backup-age-recipient.pub}
workdir=${ORACLE_ANALYZER_BACKUP_WORKDIR:-$ORACLE_ANALYZER_ROOT/backup-workdir}

if [[ -n "$local_remote" && "$test_mode" != "1" ]]; then
  echo "oracle-analyzer backup: a local remote is only allowed in the repository test" >&2
  exit 1
fi
if [[ "$test_mode" == "1" && -z "$local_remote" ]]; then
  echo "oracle-analyzer backup: test mode needs ORACLE_ANALYZER_BACKUP_LOCAL_REMOTE" >&2
  exit 1
fi
if [[ "$test_mode" != "1" && -z "$repo" ]]; then
  echo "oracle-analyzer backup: ORACLE_ANALYZER_BACKUP_REPO is empty" >&2
  exit 1
fi
if [[ ! -d "$VIDEO_TEST_ROOT" ]]; then
  echo "oracle-analyzer backup: VIDEO_TEST_ROOT does not exist" >&2
  exit 1
fi

as_owner() {
  if [[ "$(id -u)" -eq 0 && "$(id -un)" != "$ORACLE_ANALYZER_USER" ]]; then
    runuser -u "$ORACLE_ANALYZER_USER" -- "$@"
  else
    "$@"
  fi
}

exec 8>"$ORACLE_ANALYZER_ROOT/backup.lock"
if ! flock -n 8; then
  echo "oracle-analyzer backup: already running"
  exit 0
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

python3 - "$VIDEO_TEST_ROOT" "$stage" "$recipient" <<'PY'
import hashlib, json, os, pathlib, re, shutil, subprocess, sys

root = pathlib.Path(sys.argv[1]).resolve()
stage = pathlib.Path(sys.argv[2])
recipient = pathlib.Path(sys.argv[3])
job_re = re.compile(r"^[0-9a-fA-F-]{36}$")
file_re = re.compile(r"^[A-Za-z0-9._-]{1,120}\.json$")
forbidden = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".wav", ".mp3", ".aac", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bin", ".pcm"}
encrypt = recipient.is_file()
copied = []
for path in root.rglob("*"):
    if path.is_symlink():
        continue
    if not path.is_file():
        continue
    relative = path.relative_to(root)
    parts = relative.parts
    if len(parts) != 3 or parts[1] != "feedback":
        continue
    if not job_re.match(parts[0]) or not file_re.match(parts[2]):
        raise SystemExit(f"refusing unexpected feedback path: {relative}")
    if path.suffix.lower() in forbidden or path.name == "source.bin":
        raise SystemExit(f"refusing media inside feedback: {relative}")
    dest_rel = pathlib.Path("feedback") / parts[0] / (parts[2] + (".age" if encrypt else ""))
    dest = stage / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if encrypt:
        subprocess.run(["age", "-R", str(recipient), "-o", str(dest), str(path)], check=True)
    else:
        shutil.copyfile(path, dest)
        os.chmod(dest, 0o600)
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    copied.append({"path": dest_rel.as_posix(), "sha256": digest, "encrypted": encrypt})
manifest = {
    "kind": "video-test-corrections",
    "encrypted": encrypt,
    "files": copied,
}
(stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
readme = stage / "README.md"
readme.write_text(
    "Creator correction JSON from the private video analyzer.\n\n"
    "This repository must stay private. It must never contain raw video, audio, frames, or evidence packages.\n",
    encoding="utf-8",
)
print(f"staged {len(copied)} correction file(s); encrypted={encrypt}")
PY

if [[ "$test_mode" == "1" ]]; then
  remote=$local_remote
else
  if [[ ! "$repo" =~ ^https://github\.com/[^/]+/[^/]+(\.git)?$ ]]; then
    echo "oracle-analyzer backup: repo URL must be one https://github.com repository" >&2
    exit 1
  fi
  if [[ ! -f "$token_file" ]]; then
    echo "oracle-analyzer backup: token file is missing" >&2
    exit 1
  fi
  mode=$(stat -c %a "$token_file")
  if (( 10#$mode % 10 != 0 )); then
    echo "oracle-analyzer backup: token file is readable by others" >&2
    exit 1
  fi
  slug=$(python3 -c 'import sys; p=sys.argv[1].split("://",1)[1].split("/",1)[1]; p=p[:-4] if p.endswith(".git") else p; print(p.strip("/"))' "$repo")
  body=$(mktemp)
  code=$(curl -sS -o "$body" -w '%{http_code}' \
    -H "Authorization: Bearer $(tr -d '[:space:]' < "$token_file")" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${slug}")
  private=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("private"))' "$body" 2>/dev/null || echo error)
  rm -f "$body"
  if [[ "$code" != "200" || "$private" != "True" ]]; then
    echo "oracle-analyzer backup: destination is not a private repository this token can see; nothing was uploaded" >&2
    exit 1
  fi
  remote=$repo
fi

if [[ "$(id -u)" -eq 0 ]]; then
  install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0700 "$(dirname "$workdir")"
else
  install -d -m 0700 "$(dirname "$workdir")"
fi
if [[ ! -d "$workdir/.git" ]]; then
  if ! as_owner git clone "$remote" "$workdir"; then
    if [[ "$(id -u)" -eq 0 ]]; then
      install -d -o "$ORACLE_ANALYZER_USER" -g "$ORACLE_ANALYZER_USER" -m 0700 "$workdir"
    else
      install -d -m 0700 "$workdir"
    fi
    as_owner git -C "$workdir" init -b "$ORACLE_ANALYZER_BACKUP_BRANCH"
    as_owner git -C "$workdir" remote add origin "$remote"
  fi
fi

as_owner bash -lc "rm -rf '$workdir/feedback' '$workdir/manifest.json' '$workdir/README.md'"
cp -a "$stage/." "$workdir/"
if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "$ORACLE_ANALYZER_USER:$ORACLE_ANALYZER_USER" "$workdir"
fi

as_owner git -C "$workdir" add -A
unexpected=$(as_owner git -C "$workdir" ls-files | python3 -c '
import sys
ok = True
for line in sys.stdin:
    path = line.strip()
    if path in {"manifest.json", "README.md"}:
        continue
    if path.startswith("feedback/") and (path.endswith(".json") or path.endswith(".json.age")) and path.count("/") == 2:
        continue
    print(path)
    ok = False
sys.exit(0 if ok else 1)
') || {
  echo "oracle-analyzer backup: refusing to commit unexpected files" >&2
  printf '%s\n' "$unexpected" >&2
  exit 1
}

if as_owner git -C "$workdir" diff --cached --quiet; then
  echo "oracle-analyzer backup: no correction changes"
  exit 0
fi

as_owner git -C "$workdir" -c user.name='Oracle analyzer' -c user.email='analyzer@localhost' commit -m "Backup video-test corrections"

if [[ "$test_mode" == "1" ]]; then
  as_owner git -C "$workdir" push origin "HEAD:${ORACLE_ANALYZER_BACKUP_BRANCH}"
  echo "oracle-analyzer backup: pushed corrections to the local test remote"
  exit 0
fi

ask=$ORACLE_ANALYZER_ROOT/backup-askpass
cat > "$ask" <<'EOF'
#!/bin/sh
case "$1" in
  *sername*) printf '%s\n' "x-access-token" ;;
  *) tr -d '[:space:]' < "$ORACLE_ANALYZER_BACKUP_TOKEN_FILE" ;;
esac
EOF
chown "$ORACLE_ANALYZER_USER:$ORACLE_ANALYZER_USER" "$ask"
chmod 0700 "$ask"
as_owner env \
  GIT_ASKPASS="$ask" \
  GIT_TERMINAL_PROMPT=0 \
  ORACLE_ANALYZER_BACKUP_TOKEN_FILE="$token_file" \
  git -C "$workdir" push origin "HEAD:${ORACLE_ANALYZER_BACKUP_BRANCH}"
rm -f "$ask"
echo "oracle-analyzer backup: pushed corrections"
