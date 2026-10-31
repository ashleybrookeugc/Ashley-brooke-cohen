#!/usr/bin/env python3
"""PP-OCRv6 text lines through RapidOCR's ONNX Runtime backend.

PaddleOCR 3.x / paddlepaddle is not the runtime. RapidOCR 3.10 ships the
PP-OCRv6 small detection and recognition models and runs them on CPU through
onnxruntime, which publishes Linux x86_64 and macOS arm64 wheels. Stdout is
JSON only.
"""
import argparse
import importlib.metadata
import json
import logging
import sys
import time


def extractor_payload():
    try:
        package_version = importlib.metadata.version("rapidocr")
    except importlib.metadata.PackageNotFoundError:
        package_version = "unknown"
    return {
        "name": "RapidOCR",
        "package_version": package_version,
        "ocr_version": "PP-OCRv6",
        "engine": "onnxruntime",
        "model_type": "small",
        "device": "cpu",
        "text_score": 0.5,
    }


def silence_logs():
    logging.disable(logging.INFO)


def engine():
    from rapidocr import RapidOCR

    silence_logs()
    return RapidOCR(params={"Global.log_level": "error", "Global.text_score": 0.5})


def line_from_detection(box, text, score):
    points = list(box)
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)
    cleaned = " ".join(str(text or "").split())
    if not cleaned:
        return None
    return {
        "text": cleaned,
        "confidence": round(float(score), 6),
        "left": left,
        "top": top,
        "width": max(0.0, right - left),
        "height": max(0.0, bottom - top),
    }


def recognize(ocr, path):
    started = time.perf_counter()
    result = ocr(path)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    texts = result.txts or ()
    scores = result.scores or ()
    boxes = result.boxes if result.boxes is not None else []
    lines = []
    for box, text, score in zip(boxes, texts, scores):
        line = line_from_detection(box, text, score)
        if line is not None:
            lines.append(line)
    return {"lines": lines, "elapsed_ms": elapsed_ms}


def version_payload():
    return extractor_payload()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", action="store_true")
    parser.add_argument("--request", help="JSON file with an images array of {id, path}")
    args = parser.parse_args()
    silence_logs()
    if args.version:
        json.dump({"extractor": version_payload()}, sys.stdout)
        sys.stdout.write("\n")
        return
    if not args.request:
        parser.error("--version or --request is required")
    with open(args.request, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    ocr = engine()
    images = []
    for item in request.get("images") or []:
        recognized = recognize(ocr, item["path"])
        images.append({"id": item["id"], **recognized})
    json.dump({"extractor": version_payload(), "images": images}, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
