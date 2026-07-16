"""
Neural speaker diarization (pyannote.audio 3.1) for already-known segments.

Same contract as diarize.py so Node can treat the two backends
interchangeably:

Input (argv[1]): path to a 16kHz mono WAV file.
Input (argv[2]): path to a JSON file: [{"startMs": int, "endMs": int}, ...]
Optional --speakers N (default 2): expected number of speakers.
Output (stdout): JSON {"speakers": [0, 1, 0, ...]} - one cluster id per
input segment, same order.

Needs HF_TOKEN in the environment (a free Hugging Face READ token) and the
gated pyannote model licenses accepted once on that account:
  - pyannote/segmentation-3.0
  - pyannote/speaker-diarization-3.1
Model weights (~100MB total) download on first run and are cached in
~/.cache/huggingface, so later runs are offline.

Unlike the MFCC fallback (which clusters whole whisper segments), pyannote
finds its own speaker turns; each whisper segment is then assigned the
speaker it overlaps MOST with -- so a segment that straddles a speaker
change gets the dominant voice rather than a coin flip.
"""

import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav_path")
    parser.add_argument("segments_path")
    parser.add_argument("--speakers", type=int, default=2)
    args = parser.parse_args()

    with open(args.segments_path, "r", encoding="utf-8") as f:
        segments = json.load(f)

    if not segments:
        print(json.dumps({"speakers": []}))
        return

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("HF_TOKEN is not set", file=sys.stderr)
        sys.exit(2)

    # Heavy imports after the cheap arg/env checks.
    import wave

    import numpy as np
    import torch
    from pyannote.audio import Pipeline

    try:  # pyannote 4.x
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=token)
    except TypeError:  # pyannote 3.x kwarg name
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=token)

    # Load the 16kHz mono PCM WAV ourselves and pass it in-memory: pyannote
    # 4.x's file decoding needs torchcodec+ffmpeg DLLs that don't load on
    # this machine, and the in-memory dict is its documented alternative.
    with wave.open(args.wav_path, "rb") as w:
        rate = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    waveform = torch.from_numpy(pcm.astype(np.float32) / 32768.0).unsqueeze(0)

    diarization = pipeline(
        {"waveform": waveform, "sample_rate": rate}, num_speakers=args.speakers
    )
    # pyannote 4.x wraps the annotation in a DiarizeOutput; 3.x returns it raw.
    if not hasattr(diarization, "itertracks"):
        diarization = getattr(diarization, "speaker_diarization", None) or getattr(
            diarization, "annotation"
        )

    # pyannote labels turns like "SPEAKER_00"; map them to stable ints in
    # order of first appearance so output matches the MFCC backend's shape.
    label_ids = {}
    turns = []  # (start_s, end_s, id)
    for turn, _, label in diarization.itertracks(yield_label=True):
        if label not in label_ids:
            label_ids[label] = len(label_ids)
        turns.append((turn.start, turn.end, label_ids[label]))

    def overlap_speaker(start_ms, end_ms):
        s, e = start_ms / 1000.0, end_ms / 1000.0
        best_id, best_overlap = None, 0.0
        for t_start, t_end, sid in turns:
            ov = min(e, t_end) - max(s, t_start)
            if ov > best_overlap:
                best_overlap, best_id = ov, sid
        return best_id

    speakers = []
    last_known = 0
    for seg in segments:
        sid = overlap_speaker(seg["startMs"], seg["endMs"])
        if sid is None:
            sid = last_known  # no overlapping turn (silence/noise): carry over
        speakers.append(int(sid))
        last_known = sid

    print(json.dumps({"speakers": speakers}))


if __name__ == "__main__":
    main()
