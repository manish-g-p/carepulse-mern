const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorContactController");

const router = express.Router();

router.use(requireAuth("doctor"));
router.get("/", listDoctors);
router.post("/", createDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

module.exports = router;
