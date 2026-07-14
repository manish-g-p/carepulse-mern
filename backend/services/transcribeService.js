const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

// Prebuilt whisper.cpp CLI + a static ffmpeg build, downloaded once via
// `npm run setup:speech` (see backend/scripts/setupSpeechTools.js). Used
// instead of the nodejs-whisper npm package because this machine has no
// C/C++ build toolchain to compile whisper.cpp from source.
//
// Paths are env-overridable so the same code runs on the Windows host (these
// defaults) and inside the Linux worker container (Dockerfile.worker sets
// WHISPER_EXE/FFMPEG_EXE to the Linux tools and mounts the model).
const WHISPER_EXE =
  process.env.WHISPER_EXE || path.join(__dirname, "..", "bin", "whisper", "Release", "whisper-cli.exe");
const WHISPER_MODEL =
  process.env.WHISPER_MODEL || path.join(__dirname, "..", "bin", "whisper", "models", "ggml-base.bin");
const FFMPEG_EXE = process.env.FFMPEG_EXE || path.join(__dirname, "..", "bin", "ffmpeg", "ffmpeg.exe");

// A bare command name (no directory part, e.g. FFMPEG_EXE=ffmpeg in the
// container) resolves via PATH at exec time, so only stat real paths here.
const toolExists = (exe) => path.basename(exe) === exe || fs.existsSync(exe);

const isSpeechToolingReady = () =>
  toolExists(WHISPER_EXE) && fs.existsSync(WHISPER_MODEL) && toolExists(FFMPEG_EXE);

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
//
// offsetMs > 0 skips that much leading audio (used by the incremental live
// transcription to only hand whisper the not-yet-committed window). The seek
// is placed AFTER -i (output seek): ffmpeg decodes from 0 and discards, which
// is sample-exact and still cheap -- MediaRecorder webm has no seek cues, so
// input seeking would be imprecise, and opus decode is trivial next to whisper.
const convertToWav = async (audioPath, offsetMs = 0) => {
  const wavPath = audioPath.slice(0, -path.extname(audioPath).length) + ".wav";
  const args = ["-y", "-i", audioPath];
  if (offsetMs > 0) args.push("-ss", (offsetMs / 1000).toFixed(3));
  args.push("-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath);
  await run(FFMPEG_EXE, args);
  return wavPath;
};

// Duration of a 16kHz mono 16-bit WAV from its size: 32 bytes per millisecond.
const wavDurationMs = (wavPath) => Math.max(0, Math.floor((fs.statSync(wavPath).size - 44) / 32));

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

module.exports = { convertToWav, wavDurationMs, transcribeSegments, isSpeechToolingReady };
