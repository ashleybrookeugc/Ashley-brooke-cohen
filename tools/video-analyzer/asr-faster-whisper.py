#!/usr/bin/env python3
"""Local faster-whisper ASR with Silero VAD word timestamps.

Stdout is JSON only. The model is the pinned Systran faster-whisper-base.en
snapshot. Inference refuses to download; setup-runtime.mjs prefetches it.
"""
import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TQDM_DISABLE", "1")

RUNTIME_ROOT = Path(__file__).resolve().parents[2] / ".video-analysis-runtime"
DOWNLOAD_ROOT = RUNTIME_ROOT / "whisper-models"
MODEL_NAME = "base.en"
MODEL_REVISION = "3d3d5dee26484f91867d81cb899cfcf72b96be6c"
EDGE_PUNCTUATION = re.compile(r"^[^0-9a-z']+|[^0-9a-z']+$")


def normalize_word(value):
    return EDGE_PUNCTUATION.sub("", str(value or "").strip().lower())


def load_model(local_files_only):
    from faster_whisper import WhisperModel

    last_error = None
    for compute_type in ("int8", "float32"):
        try:
            model = WhisperModel(
                MODEL_NAME,
                device="cpu",
                compute_type=compute_type,
                download_root=str(DOWNLOAD_ROOT),
                local_files_only=local_files_only,
                revision=MODEL_REVISION,
            )
            return model, compute_type
        except Exception as error:
            last_error = error
            message = str(error).lower()
            if compute_type == "int8" and ("compute type" in message or "int8" in message):
                continue
            raise
    raise last_error


def extractor(compute_type):
    import faster_whisper

    return {
        "name": "faster-whisper",
        "package_version": faster_whisper.__version__,
        "model_family": MODEL_NAME,
        "model_revision": MODEL_REVISION,
        "model_path_basename": MODEL_NAME,
        "timestamp_basis": "Silero VAD plus faster-whisper word timestamps on 16 kHz PCM",
        "device": "cpu",
        "compute_type": compute_type,
        "vad": "silero",
        "vad_model": "silero_vad_v6.onnx",
        "direct_audio_audition": False,
    }


def transcribe(wav_path):
    logging.getLogger("faster_whisper").setLevel(logging.ERROR)
    model, compute_type = load_model(local_files_only=True)
    segments, _info = model.transcribe(
        wav_path,
        language="en",
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False,
    )
    spans = []
    for segment in segments:
        words = []
        for token in segment.words or []:
            text = normalize_word(token.word)
            if not text:
                continue
            words.append({
                "word": text,
                "start_seconds": round(float(token.start), 4),
                "end_seconds": round(float(token.end), 4),
                "confidence": round(float(token.probability), 6),
            })
        if not words:
            continue
        confidence = sum(item["confidence"] for item in words) / len(words)
        spans.append({
            "observation_id": f"speech-{len(spans) + 1:06d}",
            "start_seconds": words[0]["start_seconds"],
            "end_seconds": words[-1]["end_seconds"],
            "text": " ".join(item["word"] for item in words),
            "words": words,
            "confidence": round(confidence, 6),
            "signal_type": "spoken_text",
            "uncertainty": "Automatic speech recognition output; not direct human/model audio audition.",
        })
    return {"extractor": extractor(compute_type), "spans": spans}


def prefetch():
    logging.getLogger("faster_whisper").setLevel(logging.ERROR)
    _model, compute_type = load_model(local_files_only=False)
    print(json.dumps({"prefetched": True, "extractor": extractor(compute_type)}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", nargs="?")
    parser.add_argument("--prefetch", action="store_true")
    parser.add_argument("--intervals-json", default=None, help="Accepted for compatibility; Silero VAD segments the audio.")
    args = parser.parse_args()
    if args.prefetch:
        prefetch()
        return
    if not args.wav:
        parser.error("a wav path is required unless --prefetch is set")
    json.dump(transcribe(args.wav), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
