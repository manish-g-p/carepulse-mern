const mongoose = require("mongoose");

// A medication reminder, owned by the notification service
// (carepulse_notifications). Created by a doctor from a session's extracted
// key items ("doctor confirms, never auto-decides" -- the system only ever
// SUGGESTS reminders; a reminder exists because a doctor clicked create).
// The patient sees their reminders on the portal dashboard. All
// cross-service references (userId, doctorId, sessionId) are plain strings
// carried in JWTs/requests -- this service never queries the other services'
// databases.
const ReminderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // patient (cross-service UUID)
    doctorId: { type: String, required: true }, // creating doctor
    sessionId: { type: String, required: true }, // source conversation
    medication: { type: String, required: true },
    // The raw extracted timing phrases, kept for display ("twice daily,
    // after food, for five days") -- the parsed fields below are derived
    // from them client-side and confirmed by the doctor.
    timingLabel: { type: String, default: "" },
    times: { type: [String], default: [] }, // "HH:mm" dose times
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }, // absent = open-ended
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", ReminderSchema);
