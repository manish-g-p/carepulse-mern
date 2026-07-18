const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listVisits,
  createVisit,
  updateVisit,
  deleteVisit,
} = require("../controllers/visitController");

const router = express.Router();

router.use(requireAuth("doctor"));
router.get("/", listVisits);
router.post("/", createVisit);
router.put("/:id", updateVisit);
router.delete("/:id", deleteVisit);

module.exports = router;
