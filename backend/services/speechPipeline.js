const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ConversationSession = require("../models/ConversationSession");
const { convertToWav, transcribeSegments } = require("./transcribeService");
const { diarizeSegments } = require("./diarizeService");
const { decryptBuffer } = require("./audioCryptoService");

const audioDir = path.join(__dirname, "..", "storage", "audio");

// The heavy post-recording pipeline: decrypt -> wav -> whisper -> diarize ->
// save transcript. Extracted from the API controller so it can run either
// in-process (fallback when no broker is available) or in the dedicated
// speech worker consuming jobs from RabbitMQ -- the Phase 5 service split.
// audioFilename on disk is AES-256-GCM encrypted, so it's decrypted to a temp
// plaintext file first (ffmpeg needs a real file), deleted immediately after.
const runSpeechProcessing = async (sessionId, audioFilename, numSpeakers = 2) => {
  let tempPlainPath;
  let wavPath;
  try {
    const decrypted = decryptBuffer(fs.readFileSync(path.join(audioDir, audioFilename)));
    tempPlainPath = path.join(os.tmpdir(), `carepulse-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webm`);
    fs.writeFileSync(tempPlainPath, decrypted);

    wavPath = await convertToWav(tempPlainPath);
    const { segments, language } = await transcribeSegments(wavPath);

    // Diarization is best-effort: if the tooling isn't installed, or it
    // errors on this clip, everything just stays labeled "Speaker 1" rather
    // than failing the whole transcript.
    let speakerIds = null;
    try {
      speakerIds = await diarizeSegments(wavPath, segments, numSpeakers);
    } catch (error) {
      console.error("diarizeSegments error:", error);
    }

    const labeledSegments = segments.map((seg, i) => ({
      ...seg,
      speaker: `Speaker ${(speakerIds ? speakerIds[i] : 0) + 1}`,
    }));

    await ConversationSession.findByIdAndUpdate(sessionId, {
      transcript: segments.map((s) => s.text).join(" ").trim(),
      segments: labeledSegments,
      transcriptStatus: "done",
      detectedLanguage: language || "",
    });
  } catch (error) {
    console.error("runSpeechProcessing error:", error);
    await ConversationSession.findByIdAndUpdate(sessionId, { transcriptStatus: "failed" });
  } finally {
    if (tempPlainPath) fs.rmSync(tempPlainPath, { force: true });
    if (wavPath) fs.rmSync(wavPath, { force: true });
  }
};

module.exports = { runSpeechProcessing };
