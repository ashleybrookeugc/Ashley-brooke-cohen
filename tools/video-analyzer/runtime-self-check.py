#!/usr/bin/env python3
"""Import the pinned extractors and print their versions as JSON."""
import importlib.metadata
import json
import sys

import cv2
import faster_whisper
import imagehash
import scenedetect


def main():
    if not hasattr(cv2, "INTER_NEAREST"):
        raise RuntimeError("OpenCV is missing INTER_NEAREST; PySceneDetect cannot run on this cv2 build.")
    json.dump({
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "faster_whisper": faster_whisper.__version__,
        "rapidocr": importlib.metadata.version("rapidocr"),
        "scenedetect": scenedetect.__version__,
        "imagehash": imagehash.__version__,
        "cv2": cv2.__version__,
    }, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
