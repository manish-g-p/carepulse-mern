const Reminder = require("../models/Reminder");

// HH:mm sanity check for dose times.
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// Ownership filter, same pattern as the conversation service: a doctor sees
// the reminders they created, a patient sees the reminders created for them.
const reminderScope = (auth) =>
  auth.role === "patient" ? { userId: auth.userId } : { doctorId: auth.doctorId };

// POST /api/reminders  (doctor)
// { userId, sessionId, medication, timingLabel?, times[], startDate?, endDate? }
const createReminder = async (req, res) => {
  try {
    const { userId, sessionId, medication, timingLabel, times, startDate, endDate } = req.body;
    if (!userId || !sessionId || !medication) {
      return res.status(400).json({ message: "userId, sessionId and medication are required" });
    }
    const doseTimes = Array.isArray(times) ? times.filter(isValidTime) : [];
    if (!doseTimes.length) {
      return res.status(400).json({ message: "At least one valid HH:mm dose time is required" });
    }

    const reminder = await Reminder.create({
      userId,
      doctorId: req.auth.doctorId,
      sessionId,
      medication: String(medication).trim(),
      timingLabel: timingLabel || "",
      times: doseTimes,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    res.status(201).json(reminder);
  } catch (error) {
    console.error("createReminder error:", error);
    res.status(500).json({ message: "Failed to create reminder" });
  }
};

// GET /api/reminders  (doctor: created by them; patient: their own)
const listReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find(reminderScope(req.auth)).sort({ createdAt: -1 });
    res.json(reminders);
  } catch (error) {
    console.error("listReminders error:", error);
    res.status(500).json({ message: "Failed to list reminders" });
  }
};

// DELETE /api/reminders/:id  (the creating doctor or the patient it's for --
// a patient may always dismiss their own reminder)
const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, ...reminderScope(req.auth) });
    if (!reminder) return res.status(404).json({ message: "Reminder not found" });
    await reminder.deleteOne();
    res.json({ deleted: true });
  } catch (error) {
    console.error("deleteReminder error:", error);
    res.status(500).json({ message: "Failed to delete reminder" });
  }
};

module.exports = { createReminder, listReminders, deleteReminder };
