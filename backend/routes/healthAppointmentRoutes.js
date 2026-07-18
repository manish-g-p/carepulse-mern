const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listAppointments,
  createAppointment,
  updateAppointment,
  completeAppointment,
  deleteAppointment,
  runReminders,
} = require("../controllers/healthAppointmentController");

const router = express.Router();

router.use(requireAuth("doctor"));
router.get("/", listAppointments);
router.post("/", createAppointment);
// Manual trigger for the daily 9 AM reminder sweep (must precede "/:id").
router.post("/reminders/run", runReminders);
router.put("/:id/complete", completeAppointment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

module.exports = router;
