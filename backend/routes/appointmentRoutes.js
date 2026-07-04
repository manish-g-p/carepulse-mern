const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const {
  createAppointment,
  getRecentAppointmentList,
  getAppointment,
  updateAppointment,
} = require("../controllers/appointmentController");

const router = express.Router();

router.post("/", createAppointment);
router.get("/", requireAdmin, getRecentAppointmentList);
router.get("/:id", getAppointment);
router.put("/:id", requireAdmin, updateAppointment);

module.exports = router;
