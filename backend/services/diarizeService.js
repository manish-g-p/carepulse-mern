const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Two diarization backends, best-available-first (Day 31):
//
// 1. pyannote.audio 3.1 (neural) -- markedly better on real conversations
//    (similar voices, room audio). Used when BOTH are present:
//      - HF_TOKEN env (free Hugging Face READ token, gated model licenses
//        accepted once on that account), and
//      - a python with pyannote installed: PYANNOTE_PYTHON env, defaulting to
//        the D:\cpt venv that already hosts torch for translation. (Short
//        drive-root path on purpose: torch's deep file tree blows past
//        MAX_PATH under the repo. On D: rather than C: to keep the multi-GB
//        install off the system drive.)
// 2. MFCC clustering (librosa + scikit-learn) -- the original $0 fallback;
//    fine for clearly-different voices, weak on same-room similar voices.
//    Runs via PYTHON_EXE (pyservices/venv on Windows, /opt/pyenv in the
//    Linux worker container, which has no pyannote -- containers fall back
//    here automatically).
//
// A pyannote failure (missing model license, cold-start download hiccup,
// out-of-memory) falls back to MFCC rather than failing the transcript --
// the same graceful-degradation rule as the broker and translation.
const VENV_PYTHON =
  process.env.PYTHON_EXE || path.join(__dirname, "..", "pyservices", "venv", "Scripts", "python.exe");
const PYANNOTE_PYTHON = process.env.PYANNOTE_PYTHON || "D:\\cpt\\Scripts\\python.exe";
const DIARIZE_SCRIPT = path.join(__dirname, "..", "pyservices", "diarize.py");
const PYANNOTE_SCRIPT = path.join(__dirname, "..", "pyservices", "diarize_pyannote.py");

const isDiarizationToolingReady = () => fs.existsSync(VENV_PYTHON) && fs.existsSync(DIARIZE_SCRIPT);

const isPyannoteReady = () =>
  Boolean(process.env.HF_TOKEN) && fs.existsSync(PYANNOTE_PYTHON) && fs.existsSync(PYANNOTE_SCRIPT);

const runPython = (exe, args) =>
  new Promise((resolve, reject) => {
    execFile(exe, args, { maxBuffer: 1024 * 1024 * 50 }, (error, out, stderr) => {
      if (error) return reject(new Error(stderr?.toString().slice(-2000) || error.message));
      resolve(out);
    });
  });

// Given a 16kHz mono WAV and a list of { startMs, endMs } segments, returns a
// same-length array of speaker cluster ids (0, 1, ...), or null if no
// diarization tooling is installed (caller should fall back gracefully
// rather than fail the whole transcript).
const diarizeSegments = async (wavPath, segments, numSpeakers = 2) => {
  if (segments.length === 0) return null;
  if (!isPyannoteReady() && !isDiarizationToolingReady()) return null;

  const segmentsPath = path.join(os.tmpdir(), `diarize-${Date.now()}-${Math.round(Math.random() * 1e9)}.json`);
  fs.writeFileSync(segmentsPath, JSON.stringify(segments.map((s) => ({ startMs: s.startMs, endMs: s.endMs }))));

  try {
    if (isPyannoteReady()) {
      try {
        const out = await runPython(PYANNOTE_PYTHON, [
          PYANNOTE_SCRIPT, wavPath, segmentsPath, "--speakers", String(numSpeakers),
        ]);
        console.log("[diarize] pyannote (neural) backend");
        return JSON.parse(out).speakers;
      } catch (error) {
        console.error("pyannote diarization failed, falling back to MFCC:", error.message);
        if (!isDiarizationToolingReady()) throw error;
      }
    }

    const out = await runPython(VENV_PYTHON, [
      DIARIZE_SCRIPT, wavPath, segmentsPath, "--speakers", String(numSpeakers),
    ]);
    return JSON.parse(out).speakers;
  } finally {
    fs.rmSync(segmentsPath, { force: true });
  }
};

module.exports = { diarizeSegments, isDiarizationToolingReady };
