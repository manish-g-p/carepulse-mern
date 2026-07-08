const mongoose = require("mongoose");

const ConversationSessionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    userId: { type: String, required: true, index: true }, // patient's User.userId
    patientName: { type: String, required: true },
    status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    consent: {
      given: { type: Boolean, default: false },
      at: { type: Date },
    },
    languagePair: { type: String, default: "" },
    audioObjectKey: { type: String, default: "" },
    transcript: { type: String, default: "" },
    transcriptStatus: {
      type: String,
      enum: ["none", "processing", "done", "failed"],
      default: "none",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConversationSession", ConversationSessionSchema);
