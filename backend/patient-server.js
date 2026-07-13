// Patient & appointment service: patient identities, registrations (with ID
// document uploads), and appointments. Owns User/Patient/Appointment in its
// own database (carepulse_patients).
const path = require("path");
const express = require("express");
const createService = require("./config/createService");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");

createService({
  name: "patient-service",
  dbName: process.env.PATIENT_DB || "carepulse_patients",
  port: process.env.PATIENT_PORT || 5002,
  mount: (app) => {
    // ID documents uploaded during registration (not PHI audio -- that lives
    // encrypted in the conversation service's storage, never served statically).
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
    app.use("/api", patientRoutes);
    app.use("/api/appointments", appointmentRoutes);
  },
});
