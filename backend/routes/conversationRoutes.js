const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadAudio = require("../middleware/uploadAudio");
const {
  listConversations,
  getConversation,
  deleteConversation,
  startConversation,
  stopConversation,
  transcribeLive,
  updateSpeakerRoles,
  translateConversation,
  getTranslationLanguages,
  getConversationExcel,
  getConversationAudio,
  getConversationAudit,
} = require("../controllers/conversationController");

const router = express.Router();

// Patients get read-only access to their OWN sessions (list, view, Excel);
// everything that records, mutates, or exposes audit/audio stays doctor-only.
// Controllers scope queries by role (see sessionScope in the controller).
router.get("/", requireAuth("doctor", "patient"), listConversations);
router.post("/", requireAuth("doctor"), startConversation);
// Must come before "/:id" so "languages" isn't swallowed as a session id.
router.get("/languages", requireAuth("doctor"), getTranslationLanguages);
router.put("/:id/stop", requireAuth("doctor"), uploadAudio.single("audio"), stopConversation);
router.post("/:id/live", requireAuth("doctor"), uploadAudio.single("audio"), transcribeLive);
router.put("/:id/speaker-roles", requireAuth("doctor"), updateSpeakerRoles);
router.post("/:id/translate", requireAuth("doctor"), translateConversation);
router.get("/:id/excel", requireAuth("doctor", "patient"), getConversationExcel);
router.get("/:id/audio", requireAuth("doctor"), getConversationAudio);
router.get("/:id/audit", requireAuth("doctor"), getConversationAudit);
router.get("/:id", requireAuth("doctor", "patient"), getConversation);
router.delete("/:id", requireAuth("doctor"), deleteConversation);

module.exports = router;
