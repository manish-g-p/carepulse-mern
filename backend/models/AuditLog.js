const mongoose = require("mongoose");

// Append-only: nothing in the app ever updates or deletes a log entry, only
// creates them. This is meant to be a durable "who accessed what, when"
// record for PHI-adjacent actions (starting/stopping a recording,
// downloading the audio or transcript).
const AuditLogSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ConversationSession", required: true },
    action: {
      type: String,
      enum: ["start", "stop", "download-audio", "download-excel"],
      required: true,
    },
    // Who performed the action. doctorId above always identifies whose audit
    // trail the entry belongs to (the session's doctor); "patient" means the
    // patient downloaded their own transcript via the portal (Day 24).
    actor: { type: String, enum: ["doctor", "patient"], default: "doctor" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
