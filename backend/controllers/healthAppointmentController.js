const HealthAppointment = require("../models/HealthAppointment");
const DoctorContact = require("../models/DoctorContact");
const { sendDueReminders } = require("../services/appointmentReminders");
const { isEmailConfigured } = require("../services/emailService");

const ownerId = (req) => req.auth.doctorId;

const POPULATE = { path: "doctor", select: "name specialization hospital" };

// GET /api/health-appointments?upcoming=1
const listAppointments = async (req, res) => {
  try {
    const filter = { ownerId: ownerId(req) };
    if (req.query.upcoming) {
      filter.status = "upcoming";
      filter.schedule = { $gte: new Date() };
    }
    const appointments = await HealthAppointment.find(filter)
      .sort({ schedule: 1 })
      .populate(POPULATE);
    res.json(appointments);
  } catch (error) {
    console.error("listAppointments error:", error);
    res.status(500).json({ message: "Failed to load appointments" });
  }
};

// POST /api/health-appointments
// { doctor, schedule, purpose, notes, reminderEnabled, notifyEmail }
const createAppointment = async (req, res) => {
  try {
    const { doctor, schedule, purpose, notes, reminderEnabled, notifyEmail } = req.body;
    if (!doctor || !schedule || !purpose) {
      return res.status(400).json({ message: "doctor, schedule and purpose are required" });
    }
    const owned = await DoctorContact.findOne({ _id: doctor, ownerId: ownerId(req) });
    if (!owned) return res.status(400).json({ message: "Doctor not found in your directory" });

    const appointment = await HealthAppointment.create({
      ownerId: ownerId(req),
      doctor,
      schedule,
      purpose,
      notes,
      reminderEnabled: reminderEnabled !== false,
      notifyEmail,
    });
    res.status(201).json(await appointment.populate(POPULATE));
  } catch (error) {
    console.error("createAppointment error:", error);
    res.status(500).json({ message: "Failed to schedule appointment" });
  }
};

// PUT /api/health-appointments/:id -- edit, cancel (status), or complete.
const updateAppointment = async (req, res) => {
  try {
    const allowed = ["doctor", "schedule", "purpose", "notes", "reminderEnabled", "notifyEmail", "status"];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if (updates.doctor) {
      const owned = await DoctorContact.findOne({ _id: updates.doctor, ownerId: ownerId(req) });
      if (!owned) return res.status(400).json({ message: "Doctor not found in your directory" });
    }
    // Rescheduling re-arms the one-shot reminder.
    const updateDoc = { $set: updates };
    if (updates.schedule) updateDoc.$unset = { reminderSentAt: 1 };

    const appointment = await HealthAppointment.findOneAndUpdate(
      { _id: req.params.id, ownerId: ownerId(req) },
      updateDoc,
      { new: true, runValidators: true }
    ).populate(POPULATE);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json(appointment);
  } catch (error) {
    console.error("updateAppointment error:", error);
    res.status(500).json({ message: "Failed to update appointment" });
  }
};

// PUT /api/health-appointments/:id/complete
const completeAppointment = async (req, res) => {
  try {
    const appointment = await HealthAppointment.findOneAndUpdate(
      { _id: req.params.id, ownerId: ownerId(req) },
      { status: "completed" },
      { new: true }
    ).populate(POPULATE);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json(appointment);
  } catch (error) {
    console.error("completeAppointment error:", error);
    res.status(500).json({ message: "Failed to complete appointment" });
  }
};

// DELETE /api/health-appointments/:id
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await HealthAppointment.findOneAndDelete({
      _id: req.params.id,
      ownerId: ownerId(req),
    });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment deleted" });
  } catch (error) {
    console.error("deleteAppointment error:", error);
    res.status(500).json({ message: "Failed to delete appointment" });
  }
};

// POST /api/health-appointments/reminders/run -- the manual trigger for the
// same sweep the 9 AM schedule runs. Reports what it did so the UI can show
// "2 sent" or "email not configured" honestly.
const runReminders = async (req, res) => {
  try {
    const result = await sendDueReminders();
    res.json({ ...result, emailConfigured: isEmailConfigured() });
  } catch (error) {
    console.error("runReminders error:", error);
    res.status(500).json({ message: "Reminder run failed" });
  }
};

module.exports = {
  listAppointments,
  createAppointment,
  updateAppointment,
  completeAppointment,
  deleteAppointment,
  runReminders,
};
