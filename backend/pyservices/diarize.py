"""
Speaker diarization for a list of already-known speech segments.

Input (argv[1]): path to a 16kHz mono WAV file.
Input (argv[2]): path to a JSON file: [{"startMs": int, "endMs": int}, ...]
Optional --speakers N (default 2): how many speaker clusters to look for.

Output (stdout): JSON {"speakers": [0, 1, 0, ...]} — one cluster id per
input segment, same order. Node does the timestamp/text bookkeeping; this
script only answers "which of these segments were said by the same voice".

Deliberately NOT using pyannote.audio (its accurate pipeline is gated on
Hugging Face — account + accepted terms + token, a manual step skipped for
today's sprint) or Resemblyzer (its neural embeddings pull in webrtcvad,
which has no prebuilt wheel and needs a C compiler this machine doesn't
have). Instead this clusters classic MFCC acoustic features per segment —
less accurate than a neural speaker embedding, but has zero native-build
dependencies and no gated model to log into.
"""

import argparse
import json

import librosa
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler

SAMPLE_RATE = 16000
MIN_SEGMENT_SAMPLES = int(0.2 * SAMPLE_RATE)


def segment_features(clip):
    mfcc = librosa.feature.mfcc(y=clip, sr=SAMPLE_RATE, n_mfcc=20)
    return np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)])


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

    wav, _ = librosa.load(args.wav_path, sr=SAMPLE_RATE, mono=True)

    features = []
    feature_indices = []
    for i, seg in enumerate(segments):
        start = int(seg["startMs"] / 1000 * SAMPLE_RATE)
        end = int(seg["endMs"] / 1000 * SAMPLE_RATE)
        clip = wav[max(start, 0):min(end, len(wav))]
        if len(clip) < MIN_SEGMENT_SAMPLES:
            continue
        features.append(segment_features(clip))
        feature_indices.append(i)

    speakers = [0] * len(segments)

    if len(features) < 2:
        print(json.dumps({"speakers": speakers}))
        return

    scaled = StandardScaler().fit_transform(np.array(features))
    n_clusters = min(args.speakers, len(features))
    clustering = AgglomerativeClustering(n_clusters=n_clusters, linkage="ward")
    labels = clustering.fit_predict(scaled)

    for idx, label in zip(feature_indices, labels):
        speakers[idx] = int(label)

    # Segments too short to get a reliable feature vector inherit the
    # nearest preceding speaker, falling back to speaker 0 at the very start.
    last_known = speakers[feature_indices[0]] if feature_indices else 0
    for i in range(len(segments)):
        if i in feature_indices:
            last_known = speakers[i]
        else:
            speakers[i] = last_known

    print(json.dumps({"speakers": speakers}))


if __name__ == "__main__":
    main()
