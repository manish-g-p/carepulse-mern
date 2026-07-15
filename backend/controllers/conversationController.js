const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const ConversationSession = require("../models/ConversationSession");
const AuditLog = require("../models/AuditLog");
const { buildTranscriptWorkbook } = require("../services/excelService");
const { encryptBuffer, decryptBuffer } = require("../services/audioCryptoService");
const { isTranslationAvailable, listLanguages, translateText } = require("../services/translateService");
const { extractKeyItems } = require("../services/clinicalExtract");
const { runSpeechProcessing } = require("../services/speechPipeline");
const { publishSpeechJob } = require("../services/speechQueue");
const { runLivePass, clearLiveState } = require("../services/liveTranscribeService");

const audioDir = path.join(__dirname, "..", "storage", "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// Serializes a session the same way res.json(doc) would (Mongoose toJSON, which
// flattens the speakerRoles Map) and attaches computed keyItems. Computed on
// read rather than stored, so it always reflects the current transcript.
const withKeyItems = (session) => ({
  ...session.toJSON(),
  keyItems: extractKeyItems(session.segments),
});

// Hands the heavy post-recording pipeline to the speech worker via RabbitMQ
// (Phase 5 split); if the broker is unreachable, runs it in-process exactly
// as before -- fire-and-forget either way, after the stop response is sent.
const dispatchSpeechProcessing = async (sessionId, audioFilename, numSpeakers) => {
  const queued = await publishSpeechJob({ sessionId, audioFilename, numSpeakers });
  if (!queued) runSpeechProcessing(sessionId, audioFilename, numSpeakers);
};

// Ownership filter for read routes shared by both roles: a doctor sees the
// sessions they recorded, a patient sees the sessions recorded about them
// (their token carries the cross-service userId).
const sessionScope = (auth) =>
  auth.role === "patient" ? { userId: auth.userId } : { doctorId: auth.doctorId };

// GET /api/conversations  (the caller's own sessions, most recent first)
const listConversations = async (req, res) => {
  try {
    const sessions = await ConversationSession.find(sessionScope(req.auth)).sort({
      createdAt: -1,
    });
    res.json(sessions.map(withKeyItems));
  } catch (error) {
    console.error("listConversations error:", error);
    res.status(500).json({ message: "Failed to list conversations" });
  }
};

// GET /api/conversations/:id  (caller must own the session -- see sessionScope)
const getConversation = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      ...sessionScope(req.auth),
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(withKeyItems(session));
  } catch (error) {
    console.error("getConversation error:", error);
    res.status(500).json({ message: "Failed to load session" });
  }
};

// DELETE /api/conversations/:id  (doctor must own the session)
// Right-to-delete: removes the session record, its encrypted audio file, and
// its audit entries. Hard delete -- there's no soft-delete/retention window
// yet, so this is irreversible and the UI confirms before calling it.
const deleteConversation = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.audioObjectKey) {
      fs.rmSync(path.join(audioDir, session.audioObjectKey), { force: true });
    }
    await AuditLog.deleteMany({ sessionId: session._id });
    await session.deleteOne();
    clearLiveState(session._id);

    res.json({ deleted: true });
  } catch (error) {
    console.error("deleteConversation error:", error);
    res.status(500).json({ message: "Failed to delete session" });
  }
};

// POST /api/conversations  { userId, patientName, consentGiven, numSpeakers }
const startConversation = async (req, res) => {
  try {
    const { userId, patientName, consentGiven, numSpeakers } = req.body;
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
      numSpeakers: Math.min(Math.max(Number(numSpeakers) || 2, 2), 4),
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
    clearLiveState(session._id);

    res.json(session);

    if (encryptedFilename) {
      dispatchSpeechProcessing(session._id.toString(), encryptedFilename, session.numSpeakers);
    }
  } catch (error) {
    console.error("stopConversation error:", error);
    res.status(500).json({ message: "Failed to stop conversation" });
  }
};

// POST /api/conversations/:id/live  (multipart/form-data, field: audio)
// HTTP-polling fallback for the incremental live transcript. The primary
// transport since Day 25 is the WebSocket (services/liveSocket.js); both are
// thin wrappers around the same runLivePass, sharing per-session state, so a
// client can switch transports mid-recording without losing progress.
const transcribeLive = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!req.file) return res.status(400).json({ message: "audio is required" });

    const { source, target } = req.body;
    res.json(await runLivePass(session._id, req.file.buffer, source, target));
  } catch (error) {
    console.error("transcribeLive error:", error);
    res.status(500).json({ message: "Live transcription failed" });
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

// GET /api/conversations/:id/excel  (caller must own the session)
const getConversationExcel = async (req, res) => {
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      ...sessionScope(req.auth),
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.segments?.length) {
      return res.status(404).json({ message: "No transcript for this session yet" });
    }

    // The audit trail belongs to the session's doctor either way; `actor`
    // records that it was the patient who downloaded their own transcript.
    await AuditLog.create({
      doctorId: session.doctorId,
      sessionId: session._id,
      action: "download-excel",
      actor: req.auth.role === "patient" ? "patient" : "doctor",
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

// How long a signed download link stays valid. Short on purpose: the link
// carries no other auth, so anyone holding it within the window can use it.
const DOWNLOAD_URL_TTL_SECONDS = 300;

// POST /api/conversations/:id/download-url  { kind: "audio" | "excel" }
// Mints a short-lived signed URL for this session's audio or Excel export.
// Ownership is checked HERE, at issuance; the redeeming GET only has to
// verify the signature and that the token matches the route. Patients can
// only get excel links (audio stays doctor-only, same as the plain route).
const createDownloadUrl = async (req, res) => {
  try {
    const { kind } = req.body;
    if (!["audio", "excel"].includes(kind)) {
      return res.status(400).json({ message: "kind must be \"audio\" or \"excel\"" });
    }
    if (kind === "audio" && req.auth.role !== "doctor") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const session = await ConversationSession.findOne({
      _id: req.params.id,
      ...sessionScope(req.auth),
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Only the identity fields -- not the original token's own iat/exp.
    const actor = { role: req.auth.role, doctorId: req.auth.doctorId, userId: req.auth.userId };
    const sig = jwt.sign(
      { role: "download", kind, sessionId: session._id.toString(), actor },
      process.env.JWT_SECRET,
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    );
    res.status(201).json({
      url: `/api/conversations/${session._id}/${kind}?sig=${sig}`,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error("createDownloadUrl error:", error);
    res.status(500).json({ message: "Failed to create download link" });
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

// GET /api/conversations/audit  (admin only)
// Recent audit entries across ALL doctors -- the admin's compliance view.
// Both collections live in this service's database, so the patientName join
// stays within the domain (doctorId is a cross-service id and is shown
// as-is; the auth service owns doctor identities).
const listAuditLog = async (req, res) => {
  try {
    const entries = await AuditLog.find({})
      .sort({ at: -1 })
      .limit(200)
      .populate("sessionId", "patientName");
    res.json(
      entries.map((e) => ({
        _id: e._id,
        action: e.action,
        actor: e.actor,
        at: e.at,
        doctorId: e.doctorId,
        sessionId: e.sessionId?._id || null,
        patientName: e.sessionId?.patientName || "(deleted session)",
      }))
    );
  } catch (error) {
    console.error("listAuditLog error:", error);
    res.status(500).json({ message: "Failed to load audit log" });
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
  createDownloadUrl,
  listAuditLog,
  listConversations,
  getConversation,
  deleteConversation,
  startConversation,
  stopConversation,
  transcribeLive,
  updateSpeakerRoles,
  translateConversation,
  getTranslationLanguages,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
};
