require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./db");

// Shared bootstrap for the per-domain services (Phase 5 split). Each service
// is its own process with its own database; this factory keeps the common
// Express plumbing (CORS, JSON, logging, health, error handling) identical
// across them without copy-paste drift.
const createService = ({ name, dbName, port, mount }) => {
  const app = express();

  connectDB(dbName);

  // Browser origin is the Vite dev server or the nginx gateway, depending on
  // how the app is opened; allow both.
  const origins = [process.env.CLIENT_ORIGIN || "http://localhost:5173", "http://localhost:8080"];
  app.use(cors({ origin: origins }));
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/api/health", (req, res) => res.json({ status: "ok", service: name }));

  mount(app);

  app.use((req, res) => res.status(404).json({ message: "Not found" }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  });

  app.listen(port, () => console.log(`[${name}] listening on ${port} (db: ${dbName})`));
  return app;
};

module.exports = createService;
