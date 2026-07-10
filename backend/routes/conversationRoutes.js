const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadAudio = require("../middleware/uploadAudio");
const {
  listConversations,
  getConversation,
  deleteConversation,
  startConversation,
  stopConversation,
  updateSpeakerRoles,
  translateConversation,
  getTranslationLanguages,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(requireAuth("doctor"));

router.get("/", listConversations);
router.post("/", startConversation);
// Must come before "/:id" so "languages" isn't swallowed as a session id.
router.get("/languages", getTranslationLanguages);
router.put("/:id/stop", uploadAudio.single("audio"), stopConversation);
router.put("/:id/speaker-roles", updateSpeakerRoles);
router.post("/:id/translate", translateConversation);
router.get("/:id/excel", getConversationExcel);
router.get("/:id/audio", getConversationAudio);
router.get("/:id/audit", getConversationAudit);
router.get("/:id", getConversation);
router.delete("/:id", deleteConversation);

module.exports = router;
