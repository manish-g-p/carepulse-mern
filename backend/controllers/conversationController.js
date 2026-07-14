const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ConversationSession = require("../models/ConversationSession");
const AuditLog = require("../models/AuditLog");
const { convertToWav, wavDurationMs, transcribeSegments } = require("../services/transcribeService");
const { buildTranscriptWorkbook } = require("../services/excelService");
const { encryptBuffer, decryptBuffer } = require("../services/audioCryptoService");
const { isTranslationAvailable, listLanguages, translateText } = require("../services/translateService");
const { extractKeyItems } = require("../services/clinicalExtract");
const { runSpeechProcessing } = require("../services/speechPipeline");
const { publishSpeechJob } = require("../services/speechQueue");

const audioDir = path.join(__dirname, "..", "storage", "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// In-memory per-session state for the incremental live transcript:
// committedMs/committedText = audio already transcribed and locked in;
// tailText = the still-revisable live edge from the last pass. Entries are
// removed on stop/delete. Held in memory only -- if the server restarts
// mid-recording the next pass just rebuilds from zero, which is consistent
// (both the offset and the text are lost together).
const liveState = new Map();

// Keep the last few seconds uncommitted so whisper can revise the live edge
// (it often re-hears a trailing half-sentence once more audio arrives).
const LIVE_TAIL_MS = 4000;

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
    liveState.delete(session._id.toString());

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
    liveState.delete(session._id.toString());

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
// Incremental live transcription: the browser posts the whole clip-so-far
// every few seconds, but whisper only runs on the audio AFTER the committed
// offset -- so a pass costs the same whether the recording is 1 or 60 minutes.
// Segments that end before the revisable tail get committed (text appended,
// offset advanced); the tail is returned but stays re-transcribable. This is
// best-effort and transient: no diarization, nothing saved or encrypted, no
// audit entry -- the real transcript+diarization still happens on Stop from
// the full recording.
const transcribeLive = async (req, res) => {
  let tmpWebm;
  let wavPath;
  try {
    const session = await ConversationSession.findOne({
      _id: req.params.id,
      doctorId: req.auth.doctorId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!req.file) return res.status(400).json({ message: "audio is required" });

    const key = session._id.toString();
    const state =
      liveState.get(key) ||
      { committedMs: 0, committedText: "", tailText: "", translatedCommitted: "", translatedTail: "", languagePair: "" };

    tmpWebm = path.join(audioDir, `live-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webm`);
    fs.writeFileSync(tmpWebm, req.file.buffer);
    wavPath = await convertToWav(tmpWebm, state.committedMs);

    const respond = () =>
      res.json({
        transcript: `${state.committedText} ${state.tailText}`.trim(),
        translatedTranscript: state.languagePair
          ? `${state.translatedCommitted} ${state.translatedTail}`.trim()
          : "",
        committedMs: state.committedMs,
      });

    const windowMs = wavDurationMs(wavPath);
    if (windowMs < 1000) {
      // Not enough new audio to be worth a whisper pass; echo the last result.
      return respond();
    }

    const { segments } = await transcribeSegments(wavPath);

    // Segment timestamps are relative to the window start (= committedMs).
    const commitCutoff = windowMs - LIVE_TAIL_MS;
    const toCommit = segments.filter((s) => s.endMs <= commitCutoff);
    const tail = segments.filter((s) => s.endMs > commitCutoff);

    const newlyCommittedText = toCommit.map((s) => s.text).join(" ").trim();
    if (toCommit.length) {
      state.committedText = `${state.committedText} ${newlyCommittedText}`.trim();
      state.committedMs += toCommit[toCommit.length - 1].endMs;
    }
    state.tailText = tail.map((s) => s.text).join(" ").trim();

    // Optional live translation, incremental like the transcript itself: only
    // newly-committed text gets a full translate; the short tail is
    // re-translated each pass. Best-effort -- any failure (or the translation
    // server being down) just means this pass returns transcript only.
    const { source, target } = req.body;
    const pair = source && target && source !== target ? `${source}->${target}` : "";
    try {
      if (pair && (await isTranslationAvailable())) {
        if (state.languagePair !== pair) {
          // Language pair (re)selected mid-recording: re-translate what's
          // committed so far once, then continue incrementally.
          state.languagePair = pair;
          state.translatedCommitted = state.committedText
            ? await translateText(state.committedText, source, target)
            : "";
        } else if (newlyCommittedText) {
          const chunk = await translateText(newlyCommittedText, source, target);
          state.translatedCommitted = `${state.translatedCommitted} ${chunk}`.trim();
        }
        state.translatedTail = state.tailText ? await translateText(state.tailText, source, target) : "";
      } else if (!pair) {
        state.languagePair = "";
        state.translatedCommitted = "";
        state.translatedTail = "";
      }
    } catch (translationError) {
      console.error("live translation pass failed:", translationError);
    }

    liveState.set(key, state);
    respond();
  } catch (error) {
    console.error("transcribeLive error:", error);
    res.status(500).json({ message: "Live transcription failed" });
  } finally {
    if (tmpWebm) fs.rmSync(tmpWebm, { force: true });
    if (wavPath) fs.rmSync(wavPath, { force: true });
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
