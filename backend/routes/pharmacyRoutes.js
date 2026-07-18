const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadMemory = require("../middleware/uploadMemory");
const {
  pharmacyStatus,
  parsePrescription,
  drugSearch,
  drugAlternatives,
} = require("../controllers/pharmacyController");

const router = express.Router();

router.use(requireAuth("doctor"));
router.get("/status", pharmacyStatus);
router.post("/prescriptions/parse", uploadMemory.single("image"), parsePrescription);
router.get("/drugs", drugSearch);
router.get("/drugs/alternatives", drugAlternatives);

module.exports = router;
