const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createReminder, listReminders, deleteReminder } = require("../controllers/reminderController");

const router = express.Router();

// Doctors create reminders (from a session's key items, confirmed in the
// UI); both roles read their own scope; either side can remove one (doctor
// retracts, patient dismisses).
router.post("/", requireAuth("doctor"), createReminder);
router.get("/", requireAuth("doctor", "patient"), listReminders);
router.delete("/:id", requireAuth("doctor", "patient"), deleteReminder);

module.exports = router;
