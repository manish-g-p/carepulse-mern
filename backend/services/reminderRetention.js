const Reminder = require("../models/Reminder");
const { retentionCutoff } = require("./retentionService");

// Purges reminders whose course ENDED more than the window ago (endDate past
// the cutoff). Open-ended reminders (no endDate) are the patient's to
// dismiss and are never auto-deleted.
const sweepReminders = async (days) => {
  const { deletedCount } = await Reminder.deleteMany({ endDate: { $lt: retentionCutoff(days) } });
  return deletedCount;
};

module.exports = { sweepReminders };
