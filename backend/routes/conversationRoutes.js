const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadAudio = require("../middleware/uploadAudio");
const {
  listConversations,
  startConversation,
  stopConversation,
  getConversationAudio,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(requireAuth("doctor"));

router.get("/", listConversations);
router.post("/", startConversation);
router.put("/:id/stop", uploadAudio.single("audio"), stopConversation);
router.get("/:id/audio", getConversationAudio);

module.exports = router;
