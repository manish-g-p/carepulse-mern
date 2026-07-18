const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  adminLogin,
  doctorRegister,
  doctorLogin,
  patientActivate,
  patientLogin,
  getDoctorProfile,
  updateDoctorProfile,
} = require("../controllers/authController");

const router = express.Router();

router.post("/admin-login", adminLogin);
router.post("/doctor/register", doctorRegister);
router.post("/doctor/login", doctorLogin);
// Profile management for the signed-in account.
router.get("/doctor/me", requireAuth("doctor"), getDoctorProfile);
router.put("/doctor/me", requireAuth("doctor"), updateDoctorProfile);
router.post("/patient/activate", patientActivate);
router.post("/patient/login", patientLogin);

module.exports = router;
