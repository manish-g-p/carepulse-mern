const fs = require("fs");
const path = require("path");
const ConversationSession = require("../models/ConversationSession");
const AuditLog = require("../models/AuditLog");
const { clearLiveState } = require("./liveTranscribeService");
const { retentionCutoff } = require("./retentionService");

const audioDir = path.join(__dirname, "..", "storage", "audio");

// Ages out COMPLETED sessions (endedAt exists and is past the window) --
// in-progress sessions are never touched, however old. Removes the same
// three things the right-to-delete endpoint removes: the encrypted audio
// blob, the audit entries, and the session document itself.
const sweepConversations = async (days) => {
  const cutoff = retentionCutoff(days);
  const expired = await ConversationSession.find({ endedAt: { $lt: cutoff } });

  for (const session of expired) {
    if (session.audioObjectKey) {
      fs.rmSync(path.join(audioDir, session.audioObjectKey), { force: true });
    }
    await AuditLog.deleteMany({ sessionId: session._id });
    await session.deleteOne();
    clearLiveState(session._id);
  }
  return expired.length;
};

module.exports = { sweepConversations };
