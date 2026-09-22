#!/bin/sh
set -eu
if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "UNTESTED — TARGET HARDWARE EXECUTION REQUIRED: run this only on Ashley's Apple Silicon MacBook Pro." >&2
  exit 3
fi
command -v node >/dev/null
command -v python3 >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
OUTPUT="${VIDEO_BENCHMARK_ARTIFACT_ROOT:-$ROOT/artifacts/video-benchmark}/machine-preflight.json"
node "$ROOT/tools/video-benchmark/benchmark.mjs" preflight --output "$OUTPUT"
echo "Preflight receipt: $OUTPUT"
echo "Next: place approved calibration bytes under VIDEO_BENCHMARK_MEDIA_ROOT, verify hashes, then resolve one versioned component environment at a time."
