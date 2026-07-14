const express = require("express");
const upload = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");
const {
  createUser,
  getUser,
  lookupUserByEmail,
  registerPatient,
  getPatient,
  createPortalInvite,
} = require("../controllers/patientController");

const router = express.Router();

router.post("/users", createUser);
// Must come before "/users/:userId" so "lookup" isn't swallowed as a userId.
router.get("/users/lookup", requireAuth("doctor"), lookupUserByEmail);
router.get("/users/:userId", getUser);
router.post("/users/:userId/portal-invite", requireAuth("doctor"), createPortalInvite);
router.post("/patients", upload.single("identificationDocument"), registerPatient);
router.get("/patients/user/:userId", getPatient);

module.exports = router;
