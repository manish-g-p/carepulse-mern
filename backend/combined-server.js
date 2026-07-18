// Combined single-process entrypoint for cheap/free hosting (e.g. Render's
// free tier). The app is normally run as four separate services behind the
// nginx gateway (auth/patient/conversation/notification, each its own DB) --
// that split is the real architecture and how docker compose runs it. But a
// free host gives you ONE small always-on instance, so here we mount every
// service's routes into a single Express app against a single database.
//
// Same route code, same models, same JWTs -- only the COMPOSITION differs.
// The heavy AI (whisper transcription, MFCC diarization, NLLB translation)
// is NOT expected to be present here: the broker connection is lazy and
// falls back, translation hides itself when unreachable, and a transcription
// attempt without the tooling just marks that session failed. Everything
// else -- auth, patients, sessions, portal, reminders, admin, audit -- works.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const doctorContactRoutes = require("./routes/doctorContactRoutes");
const documentRoutes = require("./routes/documentRoutes");
const visitRoutes = require("./routes/visitRoutes");
const healthAppointmentRoutes = require("./routes/healthAppointmentRoutes");
const pharmacyRoutes = require("./routes/pharmacyRoutes");
const overviewRoutes = require("./routes/overviewRoutes");
const { scheduleDailyReminders } = require("./services/appointmentReminders");
const { attachLiveSocket } = require("./services/liveSocket");
const { scheduleRetention } = require("./services/retentionService");
const { sweepConversations } = require("./services/conversationRetention");
const { sweepReminders } = require("./services/reminderRetention");

// One database for the whole combined instance (the split uses four).
const dbName = process.env.COMBINED_DB || "carepulse";
connectDB(dbName);

const app = express();

// Allow the deployed frontend origin(s). CLIENT_ORIGIN may be a single URL or
// a comma-separated list; localhost is always allowed for local runs.
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [...configuredOrigins, "http://localhost:5173", "http://localhost:8080"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "combined", db: dbName })
);

// Same mounts the four individual services use, in one app.
app.use("/api/auth", authRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/conversations", conversationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/appointments", appointmentRoutes);
// Health Records module (doctor directory, documents, visits, scheduled
// appointments, pharmacy assistant, overview).
app.use("/api/doctors", doctorContactRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/health-appointments", healthAppointmentRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/overview", overviewRoutes);
app.use("/api", patientRoutes); // last: its "/api/*" is the broadest

app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// Render (and most PaaS) inject PORT; fall back for local runs.
const port = process.env.PORT || 5000;
const server = app.listen(port, () =>
  console.log(`[combined-server] listening on ${port} (db: ${dbName})`)
);

// Live-transcript WebSocket (no-op without whisper, but harmless to attach).
attachLiveSocket(server);

// Retention stays opt-in via RETENTION_DAYS (disabled by default).
scheduleRetention("conversation-sessions", sweepConversations);
scheduleRetention("reminders", sweepReminders);

// Daily 9 AM appointment reminder emails (no-ops politely without SMTP creds).
scheduleDailyReminders("combined-server");
