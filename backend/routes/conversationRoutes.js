const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listConversations,
  startConversation,
  stopConversation,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(requireAuth("doctor"));

router.get("/", listConversations);
router.post("/", startConversation);
router.put("/:id/stop", stopConversation);

module.exports = router;
