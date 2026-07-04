const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    birthDate: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    address: { type: String, required: true },
    occupation: { type: String, required: true },
    emergencyContactName: { type: String, required: true },
    emergencyContactNumber: { type: String, required: true },
    primaryPhysician: { type: String, required: true },
    insuranceProvider: { type: String, required: true },
    insurancePolicyNumber: { type: String, required: true },
    allergies: { type: String },
    currentMedication: { type: String },
    familyMedicalHistory: { type: String },
    pastMedicalHistory: { type: String },
    identificationType: { type: String },
    identificationNumber: { type: String },
    identificationDocumentUrl: { type: String },
    identificationDocumentId: { type: String },
    privacyConsent: { type: Boolean, default: false },
    treatmentConsent: { type: Boolean, default: false },
    disclosureConsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", PatientSchema);
