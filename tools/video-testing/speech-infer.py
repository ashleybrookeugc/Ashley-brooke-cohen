"""Offline source-audio transcription. No hosted API or network access."""
import os
os.environ.update(HF_HUB_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', TRANSFORMERS_OFFLINE='1')
import contextlib, json, sys
from pathlib import Path
import mlx.core as mx
from mlx_audio.stt.models.whisper import Model, ModelConfig

def main():
    request = json.load(sys.stdin)
    path = Path(sys.argv[1])
    with contextlib.redirect_stdout(sys.stderr):
        model = Model(ModelConfig.from_dict(json.loads((path / 'config.json').read_text())))
        weights = model.sanitize(mx.load(str(path / 'model.safetensors')))
        # This native conversion stores alignment metadata alongside parameters.
        # The pinned processor generation_config supplies the alignment heads.
        weights.pop('alignment_heads', None)
        model.load_weights(list(weights.items()), strict=True)
        mx.eval(model.parameters())
        model = Model.post_load_hook(model, path)
        result = model.generate(request['audio'], temperature=0,
                                condition_on_previous_text=False, return_timestamps=True,
                                word_timestamps=True, verbose=None)
    json.dump({'language': result.language, 'segments': result.segments}, sys.stdout)

if __name__ == '__main__':
    main()
