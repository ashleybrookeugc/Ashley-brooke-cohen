# Video analyzer synchronized-evidence foundation

This is the reusable real-media layer behind the portfolio analyzer. It ingests direct local files and retrievable direct-media URLs into a content-addressed `MediaAsset`, verifies complete-source decode, and writes a synchronized evidence package. It is deliberately separate from the Cloudflare Worker: the Worker has D1 but no native-media runtime or approved large-object store.

## Run

Prerequisites: Node 20+, Python 3 with `venv`, `ffmpeg`, `ffprobe`, and `tesseract` on `PATH`.

```sh
npm run video:setup-runtime
npm run video:ingest -- /path/to/video.mov
```

The setup command creates an ignored local Python environment pinned to PocketSphinx 5.0.4. The ingest command preserves the input and writes a package under `.video-analysis/video-<content-hash>/` containing:

- `manifest.json`: stable content-based `MediaAsset` identity, source/location, SHA-256, duration, probe/decode coverage, analyzer version, package identity, separate local/remote persistence states, retention state, and safe-deletion checks;
- `evidence.json`: distinct spoken-audio, speaker-turn, caption, other-text, sampled semantic visual-state, and scene-change lanes plus modality conflicts and a provenance-bearing synchronized timeline;
- fixed-cadence source frames and a 16 kHz mono PCM audio derivative used by the extractors.

Direct video URLs enter the same pipeline and resolve to the same `MediaAsset` ID as a local file containing identical bytes. Public social pages are not scraped here. HTML/non-media, access challenges, removed sources, and temporary failures remain distinct intake outcomes.

## Evidence boundaries

- PocketSphinx output is automatic speech recognition with word timestamps and confidence, not direct human/model audio audition.
- Silence-bounded utterances provide turn boundaries only. Speaker clustering and identity are not implemented, so speakers remain `speaker_unknown`.
- Caption classification uses layout plus temporal ASR overlap. OCR never silently corrects ASR; disagreements are preserved as unresolved cross-modal conflicts.
- Visual evidence is fixed-cadence sampling with bounded motion/state and OCR-keyword activity candidates. It can preserve editing-workflow, unrelated-browsing/watching, and indeterminate candidates, but is not frame-exhaustive and does not yet recover subjects/objects robustly.
- Raw ASR, OCR, and sampled visual observations remain separate from higher-order creative analysis.

## Persistence and deletion boundary

Local write/read-back verifies package structure, synchronized-timeline provenance, and the evidence digest. The package remains gitignored and tied to the current machine/workspace.

The code includes a tested remote-store contract that requires a stable locator and digest-verified remote read-back, but no concrete remote provider is configured. The existing UGC app's iCloud Drive lifecycle is the leading reuse candidate; promoting its phone-to-analysis bridge requires Ashley's explicit approval and a real-device test. Until a provider survives this environment and a later authorized session retrieves and reverifies the package, `safe_to_delete_original` remains `false`.

The legacy `/api/admin/video-analysis` endpoint remains metadata-only and is labeled `METADATA_ONLY`; it is not this pipeline.
