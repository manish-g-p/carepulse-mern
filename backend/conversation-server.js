// Conversation service: recording sessions, live/final transcription,
// diarization dispatch, translation, Excel export, audit log. Owns
// ConversationSession/AuditLog in its own database (carepulse_conversations)
// -- the same one the speech worker writes transcripts to. Identifies doctors
// purely by the JWT's doctorId; never queries the auth service's data.
const createService = require("./config/createService");
const conversationRoutes = require("./routes/conversationRoutes");

createService({
  name: "conversation-service",
  dbName: process.env.CONVERSATION_DB || "carepulse_conversations",
  port: process.env.CONVERSATION_PORT || 5003,
  mount: (app) => {
    app.use("/api/conversations", conversationRoutes);
  },
});
