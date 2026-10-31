#!/usr/bin/env python3
"""Shot boundaries from PySceneDetect, with imagehash near-duplicate suppression.

ContentDetector's default score (27) catches hard visual cuts. Screen recordings
in this project often change only the rendered UI, which measures around a
content score of 2 and does not cross 27. HashDetector at 0.2 (normalized
perceptual-hash distance) catches those layout cuts. imagehash phash then drops
a proposed cut when the adjacent frames are near-duplicates (hamming distance
<= 4). Static and recompressed-still fixtures measure 0.
"""
import json
import sys

CONTENT_THRESHOLD = 27.0
HASH_THRESHOLD = 0.2
MIN_SCENE_SECONDS = 0.2
NEAR_DUPLICATE_MAX_DISTANCE = 4
CUT_DEDUPE_SECONDS = 0.2


def phash_distance(capture, previous_frame, frame_index):
    import cv2
    import imagehash
    from PIL import Image

    def read_at(index):
        if index < 0:
            return None
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = capture.read()
        if not ok or frame is None:
            return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return imagehash.phash(Image.fromarray(rgb))

    previous = read_at(previous_frame)
    current = read_at(frame_index)
    if previous is None or current is None:
        return None
    return int(previous - current)


def detect(path):
    import imagehash
    import scenedetect
    from scenedetect import ContentDetector, HashDetector, SceneManager, open_video
    import cv2

    video = open_video(path)
    manager = SceneManager()
    manager.add_detector(ContentDetector(threshold=CONTENT_THRESHOLD, min_scene_len=MIN_SCENE_SECONDS))
    manager.add_detector(HashDetector(threshold=HASH_THRESHOLD, min_scene_len=MIN_SCENE_SECONDS))
    manager.detect_scenes(video, show_progress=False)
    scenes = manager.get_scene_list()
    capture = cv2.VideoCapture(path)
    observations = []
    suppressed = 0
    try:
        for start, _end in scenes[1:]:
            timestamp = round(float(start.seconds), 6)
            if observations and timestamp - observations[-1]["timestamp_seconds"] < CUT_DEDUPE_SECONDS:
                suppressed += 1
                continue
            distance = phash_distance(capture, start.frame_num - 1, start.frame_num)
            if distance is not None and distance <= NEAR_DUPLICATE_MAX_DISTANCE:
                suppressed += 1
                continue
            observation = {
                "timestamp_seconds": timestamp,
                "signal_type": "scene_change_candidate",
                "threshold": HASH_THRESHOLD,
                "content_detector_threshold": CONTENT_THRESHOLD,
                "hash_detector_threshold": HASH_THRESHOLD,
            }
            if distance is not None:
                observation["imagehash_phash_distance"] = distance
            observations.append(observation)
    finally:
        capture.release()
    return {
        "extractor": {
            "name": "PySceneDetect",
            "package_version": scenedetect.__version__,
            "detectors": [
                {"name": "ContentDetector", "threshold": CONTENT_THRESHOLD, "min_scene_len_seconds": MIN_SCENE_SECONDS},
                {"name": "HashDetector", "threshold": HASH_THRESHOLD, "min_scene_len_seconds": MIN_SCENE_SECONDS},
            ],
            "near_duplicate_suppression": {
                "library": "imagehash",
                "version": imagehash.__version__,
                "method": "phash",
                "max_hamming_distance": NEAR_DUPLICATE_MAX_DISTANCE,
                "suppressed_count": suppressed,
            },
        },
        "observations": observations,
    }


def main():
    if len(sys.argv) != 2:
        print("usage: scene-detect.py VIDEO", file=sys.stderr)
        sys.exit(2)
    json.dump(detect(sys.argv[1]), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
