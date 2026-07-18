const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getOverview } = require("../controllers/overviewController");

const router = express.Router();

router.get("/", requireAuth("doctor"), getOverview);

module.exports = router;
