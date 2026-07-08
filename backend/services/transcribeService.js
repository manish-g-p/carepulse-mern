const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

// Prebuilt whisper.cpp CLI + a static ffmpeg build, downloaded once via
// `npm run setup:speech` (see backend/scripts/setupSpeechTools.js). Used
// instead of the nodejs-whisper npm package because this machine has no
// C/C++ build toolchain to compile whisper.cpp from source.
const WHISPER_EXE = path.join(__dirname, "..", "bin", "whisper", "Release", "whisper-cli.exe");
const WHISPER_MODEL = path.join(__dirname, "..", "bin", "whisper", "models", "ggml-base.bin");
const FFMPEG_EXE = path.join(__dirname, "..", "bin", "ffmpeg", "ffmpeg.exe");

const isSpeechToolingReady = () =>
  fs.existsSync(WHISPER_EXE) && fs.existsSync(WHISPER_MODEL) && fs.existsSync(FFMPEG_EXE);

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr?.toString().slice(-2000) || error.message));
      resolve({ stdout, stderr });
    });
  });

// whisper.cpp's bundled decoder doesn't read WebM/Opus (only flac/mp3/ogg/wav),
// so the browser's MediaRecorder output has to be converted to a plain WAV first.
// Also used as-is by diarizeService, which needs the same 16kHz mono WAV.
const convertToWav = async (audioPath) => {
  const wavPath = audioPath.slice(0, -path.extname(audioPath).length) + ".wav";
  await run(FFMPEG_EXE, ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath]);
  return wavPath;
};

// Transcribes a WAV file to timestamped segments via whisper.cpp's JSON output.
// Returns { text, segments: [{ startMs, endMs, text }] }.
const transcribeSegments = async (wavPath) => {
  if (!isSpeechToolingReady()) {
    throw new Error("Speech tooling not installed. Run: npm run setup:speech (in backend/)");
  }

  const outBase = wavPath.slice(0, -path.extname(wavPath).length);
  const jsonPath = `${outBase}.json`;

  try {
    await run(WHISPER_EXE, ["-m", WHISPER_MODEL, "-f", wavPath, "-oj", "-of", outBase, "-l", "auto", "-np"]);
    if (!fs.existsSync(jsonPath)) return { text: "", segments: [] };

    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const segments = (parsed.transcription || []).map((seg) => ({
      startMs: seg.offsets.from,
      endMs: seg.offsets.to,
      text: seg.text.trim(),
    }));
    const text = segments.map((s) => s.text).join(" ").trim();
    return { text, segments };
  } finally {
    fs.rmSync(jsonPath, { force: true });
  }
};

module.exports = { convertToWav, transcribeSegments, isSpeechToolingReady };
