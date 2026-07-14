const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Portal login credentials for a patient, owned by the auth service
// (carepulse_auth). The patient's PROFILE (User) stays in the patient
// service's database -- this record only links an email/password to the
// cross-service userId carried in JWTs. It is created by redeeming a
// doctor-issued invite token (see authController.patientActivate), which is
// how the auth service learns the userId without ever querying the patient
// service's data.
const PatientCredentialSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

PatientCredentialSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("PatientCredential", PatientCredentialSchema);
