const HealthAppointment = require("../models/HealthAppointment");
const { isEmailConfigured, sendMail } = require("./emailService");

// Daily appointment reminder emails. The sweep finds upcoming appointments
// inside the next 24 hours that still want a reminder and haven't had one
// (reminderSentAt is the idempotency marker), mails each, and reports what
// it did. It runs automatically every day at 9 AM server time and can also
// be triggered manually from the UI (POST /health-appointments/reminders/run).

const sendDueReminders = async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const due = await HealthAppointment.find({
    status: "upcoming",
    reminderEnabled: true,
    reminderSentAt: { $exists: false },
    schedule: { $gte: now, $lte: windowEnd },
  }).populate("doctor", "name specialization hospital");

  if (!isEmailConfigured()) {
    return { checked: due.length, sent: 0, skipped: due.length, reason: "email not configured" };
  }

  let sent = 0;
  let skipped = 0;
  for (const appt of due) {
    if (!appt.notifyEmail) {
      skipped += 1;
      continue;
    }
    const when = appt.schedule.toLocaleString();
    const doctorName = appt.doctor?.name || "your doctor";
    const where = appt.doctor?.hospital ? ` at ${appt.doctor.hospital}` : "";
    try {
      await sendMail({
        to: appt.notifyEmail,
        subject: `Appointment reminder: ${doctorName} — ${when}`,
        text:
          `This is a reminder of your upcoming appointment.\n\n` +
          `Doctor: ${doctorName}${appt.doctor?.specialization ? ` (${appt.doctor.specialization})` : ""}${where}\n` +
          `When: ${when}\n` +
          `Purpose: ${appt.purpose}\n` +
          (appt.notes ? `Notes: ${appt.notes}\n` : "") +
          `\n— CarePulse`,
      });
      appt.reminderSentAt = new Date();
      await appt.save();
      sent += 1;
    } catch (error) {
      console.error(`[reminders] failed to email ${appt.notifyEmail}: ${error.message}`);
      skipped += 1;
    }
  }
  return { checked: due.length, sent, skipped };
};

// Fires the sweep at the next 9:00 AM (server time), then every 24 hours.
const scheduleDailyReminders = (label) => {
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - Date.now();
  console.log(`[${label}] appointment reminder sweep scheduled for ${next.toLocaleString()}`);
  setTimeout(() => {
    const run = () =>
      sendDueReminders()
        .then((r) => console.log(`[${label}] reminder sweep: ${JSON.stringify(r)}`))
        .catch((e) => console.error(`[${label}] reminder sweep failed:`, e.message));
    run();
    setInterval(run, 24 * 60 * 60 * 1000);
  }, delay);
};

module.exports = { sendDueReminders, scheduleDailyReminders };
