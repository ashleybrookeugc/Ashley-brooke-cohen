# Video analyzer media foundation

This is the first trustworthy real-media layer behind the portfolio analyzer. It is deliberately local because the current production route is a Cloudflare Worker with D1 only; that runtime cannot run `ffmpeg`, and the repository has no durable raw-media binding.

## Run

Prerequisites: Node 20+, `ffmpeg`, `ffprobe`, and `tesseract` on `PATH`.

```sh
npm run video:ingest -- /path/to/video.mov
```

The command preserves the input and writes a content-addressed package under `.video-analysis/` containing:

- `manifest.json` with source identity, SHA-256, duration, versions, processing/coverage state, package identity, and raw-source retention state;
- `evidence.json` with separate synchronized evidence lanes;
- sampled source frames used by the raw visual/OCR foundation.

Direct video URLs are accepted when the response actually returns video bytes. A public social page that is HTML, bot-blocked, removed, or temporarily unavailable receives a distinct intake classification.

## Current boundary

This slice proves direct-file intake, complete-stream decode, raw OCR/frame/scene-change extraction, durable package persistence, read-back integrity, and the safe-deletion gate. It does **not** yet bundle ASR, diarization, semantic visual/action extraction, or OCR classification. Therefore a source with audio or unresolved visual evidence will truthfully remain **not safe to delete**.

The legacy `/api/admin/video-analysis` endpoint remains metadata-only and is labeled `METADATA_ONLY`; it is not this pipeline.
