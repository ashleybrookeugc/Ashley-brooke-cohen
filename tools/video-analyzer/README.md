# Video analyzer synchronized-evidence foundation

This is the reusable real-media layer behind the portfolio analyzer. It ingests direct local files and retrievable direct-media URLs into a content-addressed `MediaAsset`, verifies complete-source decode, and writes a synchronized evidence package. It is deliberately separate from the Cloudflare Worker: the Worker has D1 but no native-media runtime or approved large-object store.

## Run

Prerequisites: Node 20+, Python 3.11 or 3.12 with `venv` (`python3.12` or `python3.11` on `PATH`; 3.13 and 3.14 are not used), `ffmpeg`, and `ffprobe`. OCR, ASR, and scene detection run from the local runtime, not from system Tesseract.

```sh
npm run video:setup-runtime
npm run video:ingest -- /path/to/video.mov
```

The setup command creates an ignored local Python environment at `.video-analysis-runtime` (venv plus a version marker). It pins faster-whisper 1.2.1 (CPU, int8 with a float32 fallback, Silero VAD, word timestamps, model `base.en` revision `3d3d5dee26484f91867d81cb899cfcf72b96be6c`), RapidOCR 3.10.0 running PP-OCRv6 small models through ONNX Runtime, PySceneDetect 0.7.2, and imagehash 4.3.2. PyAV is pinned to 16.1.0 because 19.x removes the `metadata_errors` argument faster-whisper still passes. PySceneDetect is installed without its OpenCV dependency so the runtime keeps `opencv-python-headless` 4.12; the current `opencv-python` 5 wheel breaks `cv2.INTER_NEAREST`. Inference does not call a network. The ingest command preserves the input and writes a package under `.video-analysis/video-<content-hash>/` containing:

- `manifest.json`: stable content-based `MediaAsset` identity, source/location, SHA-256, duration, probe/decode coverage, analyzer version, package identity, separate local/remote persistence states, retention state, and safe-deletion checks;
- `evidence.json`: distinct spoken-audio, speaker-turn, caption, other-text, sampled semantic visual-state, and scene-change lanes plus modality conflicts and a provenance-bearing synchronized timeline;
- fixed-cadence source frames and a 16 kHz mono PCM audio derivative used by the extractors.

Direct video URLs enter the same pipeline and resolve to the same `MediaAsset` ID as a local file containing identical bytes. Public social pages are not scraped here. HTML/non-media, access challenges, removed sources, and temporary failures remain distinct intake outcomes.

## Evidence boundaries

- faster-whisper output is automatic speech recognition with Silero VAD word timestamps and confidence, not direct human/model audio audition. Missing the runtime is `extractor_unavailable`; a non-zero ASR process is `extractor_failed`.
- Silero VAD speech segments provide turn boundaries only. Speaker clustering and identity are not implemented, so speakers remain `speaker_unknown`.
- Caption classification uses layout plus temporal ASR overlap. OCR never silently corrects ASR; disagreements are preserved as unresolved cross-modal conflicts. On-screen text comes from RapidOCR PP-OCRv6. Sampled-frame duplicates are memoized by exact frame SHA-256 when that mode is requested. The performance event still reports `tesseract_invocation_count` because the frozen P-002 receipt reads that field; it now counts RapidOCR passes.
- Visual evidence is fixed-cadence sampling with bounded motion/state and OCR-keyword activity candidates. It can preserve editing-workflow, unrelated-browsing/watching, and indeterminate candidates, but is not frame-exhaustive and does not yet recover subjects/objects robustly.
- Raw ASR, OCR, and sampled visual observations remain separate from higher-order creative analysis.

## Persistence and deletion boundary

Local write/read-back verifies package structure, synchronized-timeline provenance, and the evidence digest. The package remains gitignored and tied to the current machine/workspace.

The code includes a tested remote-store contract that requires a stable locator and digest-verified remote read-back, but no concrete remote provider is configured. The existing UGC app's iCloud Drive lifecycle is the leading reuse candidate; promoting its phone-to-analysis bridge requires Ashley's explicit approval and a real-device test. Until a provider survives this environment and a later authorized session retrieves and reverifies the package, `safe_to_delete_original` remains `false`.

The legacy `/api/admin/video-analysis` endpoint remains metadata-only and is labeled `METADATA_ONLY`; it is not this pipeline.
