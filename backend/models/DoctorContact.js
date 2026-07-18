const mongoose = require("mongoose");

// A doctor in the signed-in user's personal directory (Health Records
// module) -- NOT a login account (that's models/Doctor.js). Owned by the
// account that created it via ownerId (the doctorId carried in the JWT), so
// every list/read/update is scoped to its owner.
const DoctorContactSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    hospital: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Text-ish search across the fields the directory filter box covers.
DoctorContactSchema.index({ ownerId: 1, name: 1 });

module.exports = mongoose.model("DoctorContact", DoctorContactSchema);
