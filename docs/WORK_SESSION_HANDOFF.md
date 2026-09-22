# Work Session Handoff

- **Repo / branch:** `ashleybrookeugc/Ashley-brooke-cohen` / `portfolio-v2`. Do not touch or merge to `main`.
- **Current basis:** audited implementation `e04e2fa901544bf6b02654cc282e165817836ded` plus `3bfd231c9e4554967a114d829509f0285da52d29`. The custom analyzer is now a **reference implementation and acceptance-test foundation**, not a settled extraction architecture.
- **Phase 2 state:** Ashley actually ran the machine preflight on the specified M4 Pro MacBook: **PASS** (macOS 26.6.2, arm64, Apple M4 Pro, 24 GB, Node 26.3.1, ffmpeg/ffprobe 8.1.1, Python 3.14.7, uv 0.11.26; no prerequisites missing). This proves only machine readiness, not any component. The six-source registry URL syntax guard now passes; media retrieval and hash verification have not started.

## Preserved acceptance contract

- Direct local files and retrievable direct-video URLs share intake; source bytes receive `mediaasset-sha256-<full hash>` identity. URL states distinguish blocked/challenged, unavailable, temporary failure, and unsupported/non-media.
- `ffprobe` inspection and a complete ffmpeg decode through EOF are mandatory. Upload/retrieval success is not decode success.
- Packages preserve separate lanes and a provenance-bearing synchronized timeline; unresolved modality conflicts remain explicit. Local content-addressed package digest and read-back are verified.
- Safe deletion is fail-closed: no automatic source deletion; local-only packages are non-deletable. Remote write, remote digest read-back, and later authorized retrieval remain unproven.
- PocketSphinx 5.0.4 only proves a tiny synthetic, timestamped ASR fixture. Silence-separated `speaker_unknown` turns are not diarization. Tesseract/sample-state output is raw/bounded evidence, not exhaustive understanding. `/api/admin/video-analysis` remains `METADATA_ONLY`.
- `npm run test:video-analyzer` passed **13/13** on 2026-09-22, including direct intake/decode, persistence/read-back, URL-state, ASR/OCR/semantic/timeline, and remote-contract negative regressions.

## Reuse decision and next architecture

- Retain the Ashley-specific MediaAsset contract, complete-decode gate, synchronized evidence/provenance/conflict model, persistence receipts, authorization boundary, and deletion policy as the acceptance layer.
- Compose mature primitives only after their Apple Silicon operational **and quality** benchmark: `faster-whisper`/WhisperX (ASR/alignment), pyannote or sherpa-onnx (unknown speaker turns), PaddleOCR, PySceneDetect, perceptual hashing, and selective MLX-VLM. Use Stepthrough-style screen-state work only as a conditional adapter; do not fork its UI/application. Klaket, watch-video, WebDevBar watch-video, vts, CoUX, and vindex are not foundations to adopt wholesale.
- Do not create a second uploader/media system. Reconcile with `ashleybrookeugc/ugc-creator-app`'s MediaAsset/AssetLocation and existing iCloud/Share-bridge direction before a storage decision. No concrete remote provider is approved or verified.

## Apple Silicon benchmark harness (prepared; target execution pending)

- Initial verification target: Ashley's **14-inch MacBook Pro (November 2024), Apple M4 Pro, 24 GB unified memory, macOS Tahoe 26.6.2**. The always-on Mac Studio remains a possible production host and requires its own compatibility/performance verification; neither machine is hard-coded into the architecture.
- The two `faster-whisper` attempts in temporary Work failed before model execution because the isolated Python environment lacked SOCKS-proxy support. Record this as **UNTESTED — WORK ENVIRONMENT LIMITATION**, not ASR-quality failure or Apple-Silicon incompatibility. The stop-loss was observed; do not retry that route here.
- `tools/video-benchmark/` now has a bounded macOS bootstrap/preflight, SHA-256 corpus verifier, registry, README, and machine-readable receipts. It does not download models/media, grant remote Mac access, create cloud resources, or store raw video in Git. The preflight requires macOS/arm64, Apple M4 Pro, at least 24 GB memory, and macOS 26.6.2 before basic target readiness can pass.
- The registry records six existing Ashley public-social source IDs (clips 01, 02, 04, 05, 08, 10). Their bytes are not present here, so corpus verification correctly reports `BLOCKED`; existing ASR/OCR drafts remain non-gold. Open corpus slots remain raw/B-roll, UGC, acting/performance, short workflow screen recording, and confirmed music/noise.
- Before candidate evaluation: obtain byte-identical sources in `VIDEO_BENCHMARK_MEDIA_ROOT`, pass SHA verification, record a bounded human-gold subset, then resolve one pinned component/model at a time. Receipts must separate operational and quality outcomes, including `UNTESTED — TARGET HARDWARE EXECUTION REQUIRED`.
- Benchmark each capability separately: intake/hash/inspection/EOF decode; ASR/timestamps/turns; OCR/caption-vs-UI; scene/keyframes/dedup/screen state; selective visual evidence; synchronized assembly/provenance/conflicts; persistence/read-back/authorized retrieval/deletion state. Conditional screen stages must not make a short Reel fail.
- Preserve **one evidence engine, multiple analysis lenses** for finished social, UGC, acting, raw footage, screen workflows, and reference videos. Reuse source extraction across lenses; invoke screen-state/OCR-change/VLM work selectively for long workflows rather than blindly per frame.

## Evidence observed during the audit

- A legitimately retrievable Ashley TikTok MP4 was fetched and inspected: SHA-256 `d812ae5ab34b95063fdf8d56d9e05d24c3acac23c98ec0f4a83e150a80faab15`, 2,607,928 bytes, 27.4667 seconds. It exercised real retrieval, frames/OCR, and PySceneDetect; it did **not** prove production ASR, diarization, semantic video understanding, phone intake, or durable storage.
- The approximately hour-long editing recording is unavailable here and was **not processed**.

## Next actions

1. Create the reproducible MacBook harness and frozen, human-gold calibration corpus; separately qualify the Mac Studio before production deployment.
2. Benchmark selected composable components against real media and quality criteria; retain negative fixtures and inspect artifacts/receipts, not only exit codes.
3. Choose/promote an approved durable media path consistent with `ugc-creator-app`, then prove remote write, read-back, and later authorized retrieval.
4. Prove a real iPhone-to-durable-storage round trip. Only after these prerequisites run and inspect the hour-long recording as end-to-end acceptance.

## Hard safety state

- **Phone-to-durable-storage round trip:** not proven.
- **Hour-long recording processed:** no.
- **SAFE TO DELETE ORIGINAL:** no. Blockers are no approved/verified durable remote source/evidence path, no future-session retrieval proof, and no production-grade component/corpus qualification.

## Read before editing

Read this file, `AGENTS.md`, `docs/TROUBLESHOOTING_LOG.md`, `docs/PORTFOLIO_VIDEO_RESEARCH_SPEC.md`, and the canonical reuse audit in `ashleybrookeugc/research-vault`. Also inspect `ugc-creator-app`'s `docs/MEDIA_ASSET_LIFECYCLE.md` before changing intake or storage.
