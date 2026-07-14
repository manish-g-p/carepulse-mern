const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");
const ConversationSession = require("../models/ConversationSession");
const { runLivePass } = require("./liveTranscribeService");

// WebSocket transport for the incremental live transcript (Day 25). The
// browser opens ws://.../api/conversations/live and speaks a small protocol:
//
//   client -> {type:"start", token, sessionId, source?, target?}   (text)
//   server -> {type:"ready"}                                        (text)
//   client -> <cumulative webm recording-so-far>                    (binary)
//   server -> {type:"transcript", transcript, translatedTranscript,
//              committedMs}                                         (text)
//   client -> {type:"config", source, target}   change translation  (text)
//   server -> {type:"error", message}            (auth/pass failure)
//
// Auth is the first message, not a query param, so tokens never end up in
// access logs. Passes run strictly one at a time per connection; if frames
// arrive while whisper is busy only the NEWEST is kept ("latest frame wins")
// -- each frame is the whole recording-so-far, so older ones are strictly
// stale. The transcript state itself lives in liveTranscribeService, shared
// with the HTTP polling fallback.
const attachLiveSocket = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname !== "/api/conversations/live") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws) => {
    // Per-connection state, set once the start message checks out.
    let sessionId = null;
    let config = { source: "", target: "" };
    let busy = false;
    let pendingFrame = null;

    const send = (obj) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    };
    const fail = (message) => {
      send({ type: "error", message });
      ws.close(4001, message);
    };

    const processFrame = async (buffer) => {
      busy = true;
      try {
        const result = await runLivePass(sessionId, buffer, config.source, config.target);
        send({ type: "transcript", ...result });
      } catch (error) {
        console.error("live socket pass failed:", error);
        send({ type: "error", message: "Live transcription pass failed" });
      }
      busy = false;
      if (pendingFrame) {
        const next = pendingFrame;
        pendingFrame = null;
        processFrame(next);
      }
    };

    ws.on("message", async (data, isBinary) => {
      if (isBinary) {
        if (!sessionId) return fail("Not authenticated");
        const buffer = Buffer.from(data);
        if (busy) {
          pendingFrame = buffer; // latest frame wins
          return;
        }
        processFrame(buffer);
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return fail("Malformed message");
      }

      if (msg.type === "start") {
        let decoded;
        try {
          decoded = jwt.verify(msg.token, process.env.JWT_SECRET);
        } catch {
          return fail("Missing or invalid token");
        }
        if (decoded.role !== "doctor") return fail("Forbidden");

        const session = await ConversationSession.findOne({
          _id: msg.sessionId,
          doctorId: decoded.doctorId,
        }).catch(() => null);
        if (!session) return fail("Session not found");

        sessionId = session._id;
        config = { source: msg.source || "", target: msg.target || "" };
        send({ type: "ready" });
      } else if (msg.type === "config") {
        if (!sessionId) return fail("Not authenticated");
        config = { source: msg.source || "", target: msg.target || "" };
      } else {
        fail("Unknown message type");
      }
    });
  });

  return wss;
};

module.exports = { attachLiveSocket };
