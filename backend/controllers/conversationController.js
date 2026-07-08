const path = require("path");
const ConversationSession = require("../models/ConversationSession");

const audioDir = path.join(__dirname, "..", "storage", "audio");

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

// POST /api/conversations  { userId, patientName }
const startConversation = async (req, res) => {
  try {
    const { userId, patientName } = req.body;
    if (!userId || !patientName) {
      return res.status(400).json({ message: "userId and patientName are required" });
    }

    const session = await ConversationSession.create({
      doctorId: req.auth.doctorId,
      userId,
      patientName,
    });

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
    }
    await session.save();

    res.json(session);
  } catch (error) {
    console.error("stopConversation error:", error);
    res.status(500).json({ message: "Failed to stop conversation" });
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

module.exports = { listConversations, startConversation, stopConversation, getConversationAudio };
