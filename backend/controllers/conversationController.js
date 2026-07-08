const fs = require("fs");
const path = require("path");
const ConversationSession = require("../models/ConversationSession");
const AuditLog = require("../models/AuditLog");
const { convertToWav, transcribeSegments } = require("../services/transcribeService");
const { diarizeSegments } = require("../services/diarizeService");
const { buildTranscriptWorkbook } = require("../services/excelService");

const audioDir = path.join(__dirname, "..", "storage", "audio");

// Fire-and-forget: transcription+diarization can take a while, so this runs
// after the stop response has already been sent rather than blocking the
// doctor's Stop click.
const runSpeechProcessing = async (sessionId, audioFilename) => {
  let wavPath;
  try {
    wavPath = await convertToWav(path.join(audioDir, audioFilename));
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
    if (wavPath) fs.rmSync(wavPath, { force: true });
  }
};

// GET /api/conversations  (the logged-in doctor's own sessions, most recent first)
const listConversations = async (req, res) => {
  try {
    const sessions = await ConversationSession.find({ doctorId: req.auth.doctorId }).sort({
      createdAt: -1,
    });
    res.json(sessions);
  } catch (error) {
    console.error("listConversations error:", error);
    res.status(500).json({ message: "Failed to list conversations" });
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
    if (req.file) {
      session.audioObjectKey = req.file.filename;
      session.transcriptStatus = "processing";
    }
    await session.save();
    await AuditLog.create({ doctorId: req.auth.doctorId, sessionId: session._id, action: "stop" });

    res.json(session);

    if (req.file) {
      runSpeechProcessing(session._id, req.file.filename);
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

    res.sendFile(session.audioObjectKey, { root: audioDir }, (error) => {
      if (error && !res.headersSent) {
        console.error("getConversationAudio error:", error);
        res.status(500).json({ message: "Failed to load audio" });
      }
    });
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
  startConversation,
  stopConversation,
  updateSpeakerRoles,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
};
