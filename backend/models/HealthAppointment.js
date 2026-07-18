const mongoose = require("mongoose");

// A future appointment the user schedules with a doctor from their
// directory (distinct from models/Appointment.js, the original public
// booking flow). `notifyEmail` is captured at creation time from the
// signed-in account because this service cannot look the email up across
// service boundaries. `reminderSentAt` makes the daily 9 AM email sweep
// idempotent -- an appointment is reminded at most once.
const HealthAppointmentSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorContact", required: true },
    schedule: { type: Date, required: true },
    purpose: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["upcoming", "completed", "cancelled"],
      default: "upcoming",
    },
    reminderEnabled: { type: Boolean, default: true },
    notifyEmail: { type: String, default: "", trim: true, lowercase: true },
    reminderSentAt: { type: Date },
  },
  { timestamps: true }
);

HealthAppointmentSchema.index({ ownerId: 1, schedule: 1 });

module.exports = mongoose.model("HealthAppointment", HealthAppointmentSchema);
