const mongoose = require("mongoose");

const ConversationSessionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    userId: { type: String, required: true, index: true }, // patient's User.userId
    patientName: { type: String, required: true },
    // How many distinct speakers to cluster the transcript into -- e.g. 3 when
    // a patient's family member ("patient party") is also in the room.
    numSpeakers: { type: Number, default: 2, min: 2, max: 4 },
    status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    consent: {
      given: { type: Boolean, default: false },
      at: { type: Date },
    },
    // e.g. "en->hi": the language the transcript was translated into (target),
    // set when the doctor runs a translation on the session.
    languagePair: { type: String, default: "" },
    audioObjectKey: { type: String, default: "" },
    transcript: { type: String, default: "" },
    transcriptStatus: {
      type: String,
      enum: ["none", "processing", "done", "failed"],
      default: "none",
    },
    segments: [
      {
        _id: false,
        startMs: Number,
        endMs: Number,
        text: String,
        translatedText: { type: String, default: "" },
        speaker: String, // generic cluster label, e.g. "Speaker 1"
      },
    ],
    // Maps a generic speaker label -> a human role, e.g. { "Speaker 1": "Doctor" }.
    // Set by the doctor after reviewing the transcript (Day 5); segments keep
    // their generic label so relabeling never has to touch segment data.
    speakerRoles: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConversationSession", ConversationSessionSchema);
