const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// librosa (MFCC features) + scikit-learn (clustering) in a local venv
// (backend/pyservices), set up via `npm run setup:diarize`. Not pyannote.audio
// (its accurate pipeline is gated on Hugging Face) or Resemblyzer (its neural
// embeddings need webrtcvad, which has no prebuilt Windows wheel) — see
// pyservices/diarize.py for the full reasoning.
const VENV_PYTHON = path.join(__dirname, "..", "pyservices", "venv", "Scripts", "python.exe");
const DIARIZE_SCRIPT = path.join(__dirname, "..", "pyservices", "diarize.py");

const isDiarizationToolingReady = () => fs.existsSync(VENV_PYTHON) && fs.existsSync(DIARIZE_SCRIPT);

// Given a 16kHz mono WAV and a list of { startMs, endMs } segments, returns a
// same-length array of speaker cluster ids (0, 1, ...), or null if the
// diarization tooling isn't installed (caller should fall back gracefully
// rather than fail the whole transcript).
const diarizeSegments = async (wavPath, segments, numSpeakers = 2) => {
  if (!isDiarizationToolingReady() || segments.length === 0) return null;

  const segmentsPath = path.join(os.tmpdir(), `diarize-${Date.now()}-${Math.round(Math.random() * 1e9)}.json`);
  fs.writeFileSync(segmentsPath, JSON.stringify(segments.map((s) => ({ startMs: s.startMs, endMs: s.endMs }))));

  try {
    const { stdout } = await new Promise((resolve, reject) => {
      execFile(
        VENV_PYTHON,
        [DIARIZE_SCRIPT, wavPath, segmentsPath, "--speakers", String(numSpeakers)],
        { maxBuffer: 1024 * 1024 * 50 },
        (error, out, stderr) => {
          if (error) return reject(new Error(stderr?.toString().slice(-2000) || error.message));
          resolve({ stdout: out });
        }
      );
    });
    return JSON.parse(stdout).speakers;
  } finally {
    fs.rmSync(segmentsPath, { force: true });
  }
};

module.exports = { diarizeSegments, isDiarizationToolingReady };
