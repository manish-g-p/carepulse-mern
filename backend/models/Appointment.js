const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    primaryPhysician: { type: String, required: true },
    schedule: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "scheduled", "cancelled"],
      default: "pending",
    },
    reason: { type: String },
    note: { type: String },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", AppointmentSchema);
