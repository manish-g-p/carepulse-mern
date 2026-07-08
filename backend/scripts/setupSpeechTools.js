// One-time local setup for speech-to-text tooling. Downloads prebuilt,
// free binaries — no C/C++ compiler needed (unlike the nodejs-whisper npm
// package, which compiles whisper.cpp from source). Windows-only for now
// (uses PowerShell's Expand-Archive to unzip); re-run is safe, it skips
// anything already present.
//
// Usage: npm run setup:speech   (from backend/)

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BIN_DIR = path.join(__dirname, "..", "bin");
const WHISPER_DIR = path.join(BIN_DIR, "whisper");
const WHISPER_EXE = path.join(WHISPER_DIR, "Release", "whisper-cli.exe");
const MODEL_PATH = path.join(WHISPER_DIR, "models", "ggml-base.bin");
const FFMPEG_DIR = path.join(BIN_DIR, "ffmpeg");
const FFMPEG_EXE = path.join(FFMPEG_DIR, "ffmpeg.exe");

const WHISPER_ZIP_URL = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip";
const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const FFMPEG_ZIP_URL =
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip";

const download = async (url, destPath) => {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await fs.promises.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
};

const unzip = (zipPath, destDir) => {
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
  ]);
};

const setupWhisper = async () => {
  if (fs.existsSync(WHISPER_EXE)) {
    console.log("whisper-cli.exe already present, skipping.");
    return;
  }
  const zipPath = path.join(BIN_DIR, "_whisper.zip");
  await download(WHISPER_ZIP_URL, zipPath);
  unzip(zipPath, WHISPER_DIR);
  fs.rmSync(zipPath);
  console.log("whisper-cli.exe installed.");
};

const setupModel = async () => {
  if (fs.existsSync(MODEL_PATH)) {
    console.log("ggml-base.bin already present, skipping.");
    return;
  }
  await download(MODEL_URL, MODEL_PATH);
  console.log("ggml-base.bin installed.");
};

const setupFfmpeg = async () => {
  if (fs.existsSync(FFMPEG_EXE)) {
    console.log("ffmpeg.exe already present, skipping.");
    return;
  }
  const zipPath = path.join(BIN_DIR, "_ffmpeg.zip");
  await download(FFMPEG_ZIP_URL, zipPath);
  const extractDir = path.join(BIN_DIR, "_ffmpeg_extract");
  unzip(zipPath, extractDir);
  const nested = fs
    .readdirSync(extractDir)
    .map((name) => path.join(extractDir, name, "bin", "ffmpeg.exe"))
    .find((p) => fs.existsSync(p));
  if (!nested) throw new Error("Could not find ffmpeg.exe inside the downloaded archive");
  fs.mkdirSync(FFMPEG_DIR, { recursive: true });
  fs.copyFileSync(nested, FFMPEG_EXE);
  fs.rmSync(zipPath);
  fs.rmSync(extractDir, { recursive: true, force: true });
  console.log("ffmpeg.exe installed.");
};

(async () => {
  await setupWhisper();
  await setupModel();
  await setupFfmpeg();
  console.log("Speech tooling ready.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
