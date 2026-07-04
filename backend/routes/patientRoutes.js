const express = require("express");
const upload = require("../middleware/upload");
const {
  createUser,
  getUser,
  registerPatient,
  getPatient,
} = require("../controllers/patientController");

const router = express.Router();

router.post("/users", createUser);
router.get("/users/:userId", getUser);
router.post("/patients", upload.single("identificationDocument"), registerPatient);
router.get("/patients/user/:userId", getPatient);

module.exports = router;
