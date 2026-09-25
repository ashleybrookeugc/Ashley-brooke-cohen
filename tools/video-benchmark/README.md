# Apple Silicon video-understanding benchmark harness

This bounded local harness separates **operational** from **quality** evidence and refuses to represent a non-macOS/arm64 environment as Ashley's MacBook. It neither downloads models/media nor controls the Mac remotely.

Initial target: 14-inch MacBook Pro (November 2024), Apple M4 Pro, 24 GB unified memory, macOS Tahoe 26.6.2. The Mac Studio needs a separate later receipt.

```sh
chmod +x tools/video-benchmark/bootstrap-macos.sh
VIDEO_BENCHMARK_ARTIFACT_ROOT="$PWD/artifacts/video-benchmark" tools/video-benchmark/bootstrap-macos.sh
export VIDEO_BENCHMARK_MEDIA_ROOT="/absolute/path/to/approved/calibration-media"
node tools/video-benchmark/benchmark.mjs verify-corpus --corpus tools/video-benchmark/calibration-corpus.json --output artifacts/video-benchmark/corpus-identity.json
```

The registry stores SHA-256 identities and constraints, never raw video. Before a candidate benchmark: verify source bytes, create direct human gold evidence, validate that record against the frozen source identities, lock one component/model/version/configuration, run bounded tests, then retain compact receipts/artifacts outside Git. The exact human-review fields, scoring units, and operational-versus-quality gates are in [HUMAN_GOLD_AND_QUALITY.md](HUMAN_GOLD_AND_QUALITY.md). `UNTESTED — TARGET HARDWARE EXECUTION REQUIRED` is neither a pass nor a rejection.
