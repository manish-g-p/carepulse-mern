const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadAudio = require("../middleware/uploadAudio");
const {
  listConversations,
  startConversation,
  stopConversation,
  updateSpeakerRoles,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(requireAuth("doctor"));

router.get("/", listConversations);
router.post("/", startConversation);
router.put("/:id/stop", uploadAudio.single("audio"), stopConversation);
router.put("/:id/speaker-roles", updateSpeakerRoles);
router.get("/:id/excel", getConversationExcel);
router.get("/:id/audio", getConversationAudio);
router.get("/:id/audit", getConversationAudit);

module.exports = router;
