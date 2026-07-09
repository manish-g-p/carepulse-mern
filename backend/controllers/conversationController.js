const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ConversationSession = require("../models/ConversationSession");
const AuditLog = require("../models/AuditLog");
const { convertToWav, transcribeSegments } = require("../services/transcribeService");
const { diarizeSegments } = require("../services/diarizeService");
const { buildTranscriptWorkbook } = require("../services/excelService");
const { encryptBuffer, decryptBuffer } = require("../services/audioCryptoService");
const { isTranslationAvailable, listLanguages, translateText } = require("../services/translateService");
const { extractKeyItems } = require("../services/clinicalExtract");

const audioDir = path.join(__dirname, "..", "storage", "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// Serializes a session the same way res.json(doc) would (Mongoose toJSON, which
// flattens the speakerRoles Map) and attaches computed keyItems. Computed on
// read rather than stored, so it always reflects the current transcript.
const withKeyItems = (session) => ({
  ...session.toJSON(),
  keyItems: extractKeyItems(session.segments),
});

// Fire-and-forget: transcription+diarization can take a while, so this runs
// after the stop response has already been sent rather than blocking the
// doctor's Stop click. audioFilename on disk is AES-256-GCM encrypted, so it
// has to be decrypted to a temp plaintext file before ffmpeg/whisper can
// read it -- that temp file is deleted immediately after, same as the
// intermediate WAV.
const runSpeechProcessing = async (sessionId, audioFilename) => {
  let tempPlainPath;
  let wavPath;
  try {
    const decrypted = decryptBuffer(fs.readFileSync(path.join(audioDir, audioFilename)));
    tempPlainPath = path.join(os.tmpdir(), `carepulse-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webm`);
    fs.writeFileSync(tempPlainPath, decrypted);

    wavPath = await convertToWav(tempPlainPath);
    const { segments } = await transcribeSegments(wavPath);

    // Diarization is best-effort: if the tooling isn't installed, or it
    // errors on this clip, everything just stays labeled "Speaker 1" rather
    // than failing the whole transcript.
    let speakerIds = null;
    try {
      speakerIds = await diarizeSegments(wavPath, segments, 2);
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
    });
  } catch (error) {
    console.error("runSpeechProcessing error:", error);
    await ConversationSession.findByIdAndUpdate(sessionId, { transcriptStatus: "failed" });
  } finally {
    if (tempPlainPath) fs.rmSync(tempPlainPath, { force: true });
    if (wavPath) fs.rmSync(wavPath, { force: true });
  }
};

// GET /api/conversations  (the logged-in doctor's own sessions, most recent first)
const listConversations = async (req, res) => {
  try {
    const sessions = await ConversationSession.find({ doctorId: req.auth.doctorId }).sort({
      createdAt: -1,
    });
    res.json(sessions.map(withKeyItems));
  } catch (error) {
    console.error("listConversations error:", error);
    res.status(500).json({ message: "Failed to list conversations" });
  }
};

// GET /api/conversations/:id  (doctor must own the session)
const getConversation = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(withKeyItems(session));
  } catch (error) {
    console.error("getConversation error:", error);
    res.status(500).json({ message: "Failed to load session" });
  }
};

// POST /api/conversations  { userId, patientName, consentGiven }
const startConversation = async (req, res) => {
  try {
    const { userId, patientName, consentGiven } = req.body;
    if (!userId || !patientName) {
      return res.status(400).json({ message: "userId and patientName are required" });
    }
    // Enforced server-side too, not just by disabling the button client-side --
    // a recording session must never exist without recorded consent.
    if (consentGiven !== true) {
      return res.status(400).json({ message: "Patient consent is required before recording can start" });
    }

    const session = await ConversationSession.create({
      doctorId: req.auth.doctorId,
      userId,
      patientName,
      consent: { given: true, at: new Date() },
    });

    await AuditLog.create({ doctorId: req.auth.doctorId, sessionId: session._id, action: "start" });

    res.status(201).json(session);
  } catch (error) {
    console.error("startConversation error:", error);
    res.status(500).json({ message: "Failed to start conversation" });
  }
};

// PUT /api/conversations/:id/stop  (multipart/form-data, optional field: audio)
const stopConversation = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.status === "completed") {
      return res.status(409).json({ message: "Session already stopped" });
    }

    session.status = "completed";
    session.endedAt = new Date();
    let encryptedFilename;
    if (req.file) {
      encryptedFilename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webm.enc`;
      fs.writeFileSync(path.join(audioDir, encryptedFilename), encryptBuffer(req.file.buffer));
      session.audioObjectKey = encryptedFilename;
      session.transcriptStatus = "processing";
    }
    await session.save();
    await AuditLog.create({ doctorId: req.auth.doctorId, sessionId: session._id, action: "stop" });

    res.json(session);

    if (encryptedFilename) {
      runSpeechProcessing(session._id, encryptedFilename);
    }
  } catch (error) {
    console.error("stopConversation error:", error);
    res.status(500).json({ message: "Failed to stop conversation" });
  }
};

// PUT /api/conversations/:id/speaker-roles  { speakerRoles: { "Speaker 1": "Doctor" } }
const updateSpeakerRoles = async (req, res) => {
  try {
    const { speakerRoles } = req.body;
    if (!speakerRoles || typeof speakerRoles !== "object") {
      return res.status(400).json({ message: "speakerRoles object is required" });
    }

    const session = await ConversationSession.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.auth.doctorId },
      { speakerRoles },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: "Session not found" });

    res.json(session);
  } catch (error) {
    console.error("updateSpeakerRoles error:", error);
    res.status(500).json({ message: "Failed to update speaker roles" });
  }
};

// POST /api/conversations/:id/translate  { source, target }
// Translates every transcript segment via the local LibreTranslate instance
// and stores the result on each segment, so the translation persists with the
// session (and lands in the Excel export) rather than being display-only.
const translateConversation = async (req, res) => {
  try {
    const { source, target } = req.body;
    if (!source || !target) {
      return res.status(400).json({ message: "source and target language codes are required" });
    }

    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.segments?.length) {
      return res.status(404).json({ message: "No transcript to translate yet" });
    }

    if (!(await isTranslationAvailable())) {
      return res.status(503).json({
        message: "Translation service is not running. Start it with: docker start libretranslate",
      });
    }

    for (const seg of session.segments) {
      seg.translatedText = await translateText(seg.text, source, target);
    }
    session.languagePair = `${source}->${target}`;
    await session.save();

    res.json(session);
  } catch (error) {
    console.error("translateConversation error:", error);
    res.status(500).json({ message: "Failed to translate the transcript" });
  }
};

// GET /api/conversations/languages  (available translation languages)
const getTranslationLanguages = async (req, res) => {
  try {
    if (!(await isTranslationAvailable())) return res.json([]);
    res.json(await listLanguages());
  } catch (error) {
    console.error("getTranslationLanguages error:", error);
    res.json([]);
  }
};

// GET /api/conversations/:id/excel  (doctor must own the session)
const getConversationExcel = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.segments?.length) {
      return res.status(404).json({ message: "No transcript for this session yet" });
    }

    await AuditLog.create({
      doctorId: req.auth.doctorId,
      sessionId: session._id,
      action: "download-excel",
    });

    const workbook = buildTranscriptWorkbook(session);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${session.patientName.replace(/[^\w-]/g, "_")}-transcript.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("getConversationExcel error:", error);
    res.status(500).json({ message: "Failed to generate transcript file" });
  }
};

// GET /api/conversations/:id/audio  (doctor must own the session)
const getConversationAudio = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session || !session.audioObjectKey) {
      return res.status(404).json({ message: "No audio for this session" });
    }

    await AuditLog.create({
      doctorId: req.auth.doctorId,
      sessionId: session._id,
      action: "download-audio",
    });

    const decrypted = decryptBuffer(fs.readFileSync(path.join(audioDir, session.audioObjectKey)));
    res.setHeader("Content-Type", "audio/webm");
    res.send(decrypted);
  } catch (error) {
    console.error("getConversationAudio error:", error);
    res.status(500).json({ message: "Failed to load audio" });
  }
};

// GET /api/conversations/:id/audit  (doctor must own the session)
const getConversationAudit = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const entries = await AuditLog.find({ sessionId: session._id }).sort({ at: 1 });
    res.json(entries);
  } catch (error) {
    console.error("getConversationAudit error:", error);
    res.status(500).json({ message: "Failed to load audit log" });
  }
};

module.exports = {
  listConversations,
  getConversation,
  startConversation,
  stopConversation,
  updateSpeakerRoles,
  translateConversation,
  getTranslationLanguages,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
};
