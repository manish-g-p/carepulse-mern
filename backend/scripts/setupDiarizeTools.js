// One-time local setup for the speaker-diarization tooling: creates a
// Python venv in backend/pyservices/venv and installs librosa + scikit-learn
// (classic MFCC-feature clustering, not a neural model — see
// pyservices/diarize.py for why). Re-run is safe: skips if the venv exists.
//
// Usage: npm run setup:diarize   (from backend/)
//
// Requires Python 3 on PATH. No C/C++ compiler needed — every dependency
// here ships a prebuilt wheel.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PYSERVICES_DIR = path.join(__dirname, "..", "pyservices");
const VENV_DIR = path.join(PYSERVICES_DIR, "venv");
const VENV_PYTHON = path.join(VENV_DIR, "Scripts", "python.exe");
const REQUIREMENTS = path.join(PYSERVICES_DIR, "requirements.txt");

if (fs.existsSync(VENV_PYTHON)) {
  console.log("Diarization venv already set up, skipping.");
  process.exit(0);
}

console.log("Creating Python venv...");
execFileSync("python", ["-m", "venv", VENV_DIR], { stdio: "inherit" });

console.log("Installing dependencies (librosa, scikit-learn)...");
execFileSync(VENV_PYTHON, ["-m", "pip", "install", "--upgrade", "pip", "-q"], { stdio: "inherit" });
execFileSync(VENV_PYTHON, ["-m", "pip", "install", "-r", REQUIREMENTS], { stdio: "inherit" });

console.log("Diarization tooling ready.");
