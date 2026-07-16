// One-time local setup for the NLLB translation server. Creates a Python venv
// and installs torch + transformers + sentencepiece + flask, then you run
// pyservices/translate_server.py with that venv's python.
//
// The venv lives at a SHORT path (D:\cpt by default, overridable via
// TRANSLATE_VENV) rather than inside the repo: torch bundles a deeply-nested
// license directory that blows past Windows' 260-char MAX_PATH when the venv
// sits under the long project path, and this machine has long-path support
// disabled (enabling it needs admin). A short root keeps the total under 260.
//
// Usage: npm run setup:translate   (from backend/)
//
// Requires Python 3 on PATH. No C/C++ compiler needed -- every dependency ships
// a prebuilt wheel. The NLLB model (~2.4GB) downloads on the server's first run.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VENV_DIR = process.env.TRANSLATE_VENV || "D:\\cpt";
const VENV_PYTHON = path.join(VENV_DIR, "Scripts", "python.exe");
const REQUIREMENTS = path.join(__dirname, "..", "pyservices", "translate-requirements.txt");
const SERVER = path.join(__dirname, "..", "pyservices", "translate_server.py");

if (fs.existsSync(VENV_PYTHON)) {
  console.log(`Translation venv already set up at ${VENV_DIR}, skipping.`);
} else {
  console.log(`Creating Python venv at ${VENV_DIR}...`);
  execFileSync("python", ["-m", "venv", VENV_DIR], { stdio: "inherit" });

  console.log("Installing dependencies (torch, transformers, sentencepiece, flask)...");
  execFileSync(VENV_PYTHON, ["-m", "pip", "install", "--upgrade", "pip", "-q"], { stdio: "inherit" });
  execFileSync(VENV_PYTHON, ["-m", "pip", "install", "-r", REQUIREMENTS], { stdio: "inherit" });
}

console.log("Translation tooling ready. Start the server with:");
console.log(`  "${VENV_PYTHON}" "${SERVER}"`);
