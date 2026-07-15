// Notification service: medication reminders derived from conversation key
// items. Owns Reminder in its own database (carepulse_notifications).
// Delivery is in-app (the patient portal dashboard) -- the $0 stack has no
// email/SMS channel, so "notification" means the portal surfaces what's due.
// Identifies callers purely by JWT (doctorId / patient userId); never
// queries the other services' data.
const createService = require("./config/createService");
const reminderRoutes = require("./routes/reminderRoutes");
const { scheduleRetention } = require("./services/retentionService");
const { sweepReminders } = require("./services/reminderRetention");

createService({
  name: "notification-service",
  dbName: process.env.NOTIFICATION_DB || "carepulse_notifications",
  port: process.env.NOTIFICATION_PORT || 5004,
  mount: (app) => {
    app.use("/api/reminders", reminderRoutes);
  },
});

// Retention (Day 27): purges reminders whose course ended more than
// RETENTION_DAYS ago. Disabled unless that env var is set.
scheduleRetention("reminders", sweepReminders);
