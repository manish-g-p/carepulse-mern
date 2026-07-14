const express = require("express");
const {
  adminLogin,
  doctorRegister,
  doctorLogin,
  patientActivate,
  patientLogin,
} = require("../controllers/authController");

const router = express.Router();

router.post("/admin-login", adminLogin);
router.post("/doctor/register", doctorRegister);
router.post("/doctor/login", doctorLogin);
router.post("/patient/activate", patientActivate);
router.post("/patient/login", patientLogin);

module.exports = router;
