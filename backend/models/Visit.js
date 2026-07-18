const mongoose = require("mongoose");

// A recorded doctor visit: when, which doctor (from the owner's directory),
// why, what was diagnosed, treatment notes, and any attached documents.
const VisitSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorContact", required: true },
    date: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    diagnosis: { type: String, default: "", trim: true },
    treatmentNotes: { type: String, default: "" },
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "MedicalDocument" }],
  },
  { timestamps: true }
);

VisitSchema.index({ ownerId: 1, date: -1 });

module.exports = mongoose.model("Visit", VisitSchema);
