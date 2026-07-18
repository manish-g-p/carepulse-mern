// Patient & appointment service: patient identities, registrations (with ID
// document uploads), appointments, and the Health Records module (personal
// doctor directory, medical documents, visits, scheduled appointments with
// email reminders, pharmacy assistant, dashboard overview). Owns
// User/Patient/Appointment plus the Health Records models in its own
// database (carepulse_patients).
const path = require("path");
const express = require("express");
const createService = require("./config/createService");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const doctorContactRoutes = require("./routes/doctorContactRoutes");
const documentRoutes = require("./routes/documentRoutes");
const visitRoutes = require("./routes/visitRoutes");
const healthAppointmentRoutes = require("./routes/healthAppointmentRoutes");
const pharmacyRoutes = require("./routes/pharmacyRoutes");
const overviewRoutes = require("./routes/overviewRoutes");
const { scheduleDailyReminders } = require("./services/appointmentReminders");

createService({
  name: "patient-service",
  dbName: process.env.PATIENT_DB || "carepulse_patients",
  port: process.env.PATIENT_PORT || 5002,
  mount: (app) => {
    // ID documents uploaded during registration (not PHI audio -- that lives
    // encrypted in the conversation service's storage, never served statically).
    // Locally-stored medical documents live under uploads/documents.
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
    app.use("/api/doctors", doctorContactRoutes);
    app.use("/api/documents", documentRoutes);
    app.use("/api/visits", visitRoutes);
    app.use("/api/health-appointments", healthAppointmentRoutes);
    app.use("/api/pharmacy", pharmacyRoutes);
    app.use("/api/overview", overviewRoutes);
    app.use("/api", patientRoutes);
    app.use("/api/appointments", appointmentRoutes);
  },
});

// Daily 9 AM appointment reminder emails (no-ops politely without SMTP creds).
scheduleDailyReminders("patient-service");
