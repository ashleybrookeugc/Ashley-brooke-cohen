#!/usr/bin/env python3
import argparse
import json
import re
import wave

import pocketsphinx
from pocketsphinx import Decoder, get_model_path


def clean_word(value):
    return re.sub(r"\(\d+\)$", "", value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav")
    parser.add_argument("--intervals-json", required=True)
    args = parser.parse_args()
    intervals = json.loads(args.intervals_json)

    with wave.open(args.wav, "rb") as source:
        if source.getnchannels() != 1 or source.getframerate() != 16000 or source.getsampwidth() != 2:
            raise RuntimeError("ASR WAV must be mono 16 kHz signed 16-bit PCM")
        frame_rate = source.getframerate()
        all_audio = source.readframes(source.getnframes())

    spans = []
    for index, interval in enumerate(intervals):
        start = float(interval["start_seconds"])
        end = float(interval["end_seconds"])
        first = max(0, int(start * frame_rate) * 2)
        last = min(len(all_audio), int(end * frame_rate) * 2)
        decoder = Decoder()
        decoder.start_utt()
        decoder.process_raw(all_audio[first:last], False, True)
        decoder.end_utt()
        hypothesis = decoder.hyp()
        if not hypothesis or not hypothesis.hypstr.strip():
            continue
        word_spans = []
        for segment in decoder.seg():
            word = clean_word(segment.word)
            if word in {"<s>", "</s>", "<sil>"}:
                continue
            word_spans.append({
                "word": word,
                "start_seconds": round(start + segment.start_frame / 100.0, 4),
                "end_seconds": round(start + segment.end_frame / 100.0, 4),
                "confidence": round(float(segment.prob), 6),
            })
        if not word_spans:
            continue
        confidence = sum(item["confidence"] for item in word_spans) / len(word_spans)
        spans.append({
            "observation_id": f"speech-{index + 1:06d}",
            "start_seconds": word_spans[0]["start_seconds"],
            "end_seconds": word_spans[-1]["end_seconds"],
            "text": " ".join(item["word"] for item in word_spans),
            "words": word_spans,
            "confidence": round(confidence, 6),
            "signal_type": "spoken_text",
            "uncertainty": "Automatic speech recognition output; not direct human/model audio audition.",
        })

    print(json.dumps({
        "extractor": {
            "name": "PocketSphinx",
            "package_version": getattr(pocketsphinx, "__version__", "5.0.4"),
            "model_family": "bundled-en-us",
            "model_path_basename": get_model_path().split("/")[-1],
            "timestamp_basis": "silence-bounded 16kHz PCM plus 100Hz decoder frames",
            "direct_audio_audition": False,
        },
        "spans": spans,
    }))


if __name__ == "__main__":
    main()
